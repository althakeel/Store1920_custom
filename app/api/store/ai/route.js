import { openai, isOpenAIConfigured } from "@/configs/openai";
import authSeller from "@/middlewares/authSeller";

import { NextResponse } from "next/server";

const parseJsonReply = (raw) => {
    const text = String(raw || '').trim();
    if (!text) throw new Error('AI returned empty response');
    const cleaned = text.replace(/```json|```/g, '').trim();
    return JSON.parse(cleaned);
};

const normalizeList = (value) => {
    if (!Array.isArray(value)) return [];
    return Array.from(new Set(value.map((item) => String(item || '').trim()).filter(Boolean)));
};

const normalizeSpecRows = (rows, columnCount) => {
    if (!Array.isArray(rows)) return [];
    return rows
        .map((row) => {
            if (!Array.isArray(row)) return null;
            const next = Array.from({ length: columnCount }, (_, idx) => String(row[idx] || '').trim());
            return next;
        })
        .filter((row) => row && row.some((cell) => cell.length > 0));
};

async function main(base64Image, mimeType, additionalContext = '', includeArabic = false) {
    const arabicSchema = includeArabic
        ? `,
                        "nameAr": string,
                        "brandAr": string,
                        "shortDescriptionAr": string,
                        "descriptionAr": string`
        : '';

    const arabicRules = includeArabic
        ? `
                        - Also provide Arabic counterparts for the required Arabic fields.
                        - Keep Arabic text natural for GCC e-commerce shoppers.`
        : '';

    const messages = [
        {
            role: "system",
            content: `
                        You are a product listing assistant for an e-commerce store.
                        Your job is to analyze an image of a product and generate rich structured listing data.

                        If additional seller context is provided, use it heavily.
                        Never invent impossible claims (for example: exact ingredients, warranty periods, certifications) unless clearly visible or explicitly provided by seller context.

                        Respond ONLY with raw JSON (no code block, no markdown, no explanation).
                        The JSON must strictly follow this schema:

                        {
                        "name": string,
                        "brand": string,
                        "shortDescription": string,
                        "shortDescription2": string,
                        "description": string,
                        "tags": string[],
                        "seoTitle": string,
                        "seoDescription": string,
                        "seoKeywords": string[],
                        "badges": string[],
                        "deliveredBy": string,
                        "soldBy": string,
                        "paymentInfo": string,
                        "specTableTitle": string,
                        "specTableColumns": string[],
                        "specTableRows": string[][]${arabicSchema}
                        }

                        Rules:
                        - Keep name concise and ecommerce-ready.
                        - Prefer 2 columns for spec table (Property, Value).
                        - specTableRows should only include rows with meaningful data.
                        - Keep tags and seoKeywords short and practical (max 10 each).
                        - If unsure about any field, return empty string or [] instead of guessing.
                            ${arabicRules}
                   `
        },
        {
            role: "user",
            content: [
                {
                    type: "text",
                    text: `Analyze this image and generate complete product listing fields. Seller context: ${additionalContext || 'none'}`,
                },
                { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64Image}` } },
            ],
        },
    ];

    const response = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        messages,
        temperature: 0.2,
    });

    const raw = response.choices[0].message.content;
    const parsed = parseJsonReply(raw);

    const specTableColumns = normalizeList(parsed.specTableColumns);
    const normalizedColumns = specTableColumns.length >= 2
        ? specTableColumns.slice(0, 2)
        : ['Property', 'Value'];

    return {
        name: String(parsed.name || '').trim(),
        brand: String(parsed.brand || '').trim(),
        shortDescription: String(parsed.shortDescription || '').trim(),
        shortDescription2: String(parsed.shortDescription2 || '').trim(),
        description: String(parsed.description || '').trim(),
        nameAr: String(parsed.nameAr || '').trim(),
        brandAr: String(parsed.brandAr || '').trim(),
        shortDescriptionAr: String(parsed.shortDescriptionAr || '').trim(),
        descriptionAr: String(parsed.descriptionAr || '').trim(),
        tags: normalizeList(parsed.tags).slice(0, 10),
        seoTitle: String(parsed.seoTitle || '').trim(),
        seoDescription: String(parsed.seoDescription || '').trim(),
        seoKeywords: normalizeList(parsed.seoKeywords).slice(0, 10),
        badges: normalizeList(parsed.badges).slice(0, 6),
        deliveredBy: String(parsed.deliveredBy || '').trim(),
        soldBy: String(parsed.soldBy || '').trim(),
        paymentInfo: String(parsed.paymentInfo || '').trim(),
        specTableTitle: String(parsed.specTableTitle || 'Product information').trim() || 'Product information',
        specTableColumns: normalizedColumns,
        specTableRows: normalizeSpecRows(parsed.specTableRows, normalizedColumns.length),
    };

}


export async function POST(request) {
    try {
        if (!isOpenAIConfigured()) {
            return NextResponse.json({ error: 'AI is disabled (missing OPENAI_API_KEY)' }, { status: 503 });
        }

        const authHeader = request.headers.get('authorization');
        let userId = null;

        if (authHeader && authHeader.startsWith('Bearer ')) {
            const idToken = authHeader.split('Bearer ')[1];
            try {
                const { getAuth } = await import('@/lib/firebase-admin');
                const adminAuth = getAuth();
                const decodedToken = await adminAuth.verifyIdToken(idToken);
                userId = decodedToken.uid;
            } catch (e) {
                return NextResponse.json({ error: 'Auth verification failed', detail: e.message }, { status: 401 });
            }
        }

        const storeId = await authSeller(userId);
        if (!storeId) {
            return NextResponse.json({ error: 'not authorized' }, { status: 401 })
        }

        const { base64Image, mimeType, additionalContext, includeArabic } = await request.json();
        if (!base64Image || !mimeType) {
            return NextResponse.json({ error: 'base64Image and mimeType are required' }, { status: 400 });
        }

        const result = await main(base64Image, mimeType, additionalContext || '', Boolean(includeArabic));
        return NextResponse.json({ ...result });
    } catch (error) {
        console.error(error);
        const status = Number(error?.status || error?.response?.status || 500);
        const safeStatus = Number.isFinite(status) && status >= 400 ? status : 500;
        const fallback429Message = 'AI rate limit reached. Please wait a moment and try again.';
        const message = String(
            error?.error?.message ||
            error?.response?.data?.error ||
            error?.response?.data?.message ||
            error?.message ||
            (safeStatus === 429 ? fallback429Message : 'AI request failed')
        ).trim();

        return NextResponse.json(
            { error: message || (safeStatus === 429 ? fallback429Message : 'AI request failed') },
            { status: safeStatus }
        );
    }
}
