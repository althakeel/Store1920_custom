import { openai, isOpenAIConfigured } from "@/configs/openai";
import authSeller from "@/middlewares/authSeller";
import connectDB from '@/lib/mongodb';
import Category from '@/models/Category';
import {
    parseAutofillJson,
    formatProductAutofillPayload,
} from '@/lib/productAiAutofill';
import { generateProductAutofillFromImage, shouldUseGeminiForProducts } from '@/lib/geminiProductAutofill';
import { isGeminiConfigured } from '@/configs/gemini';
import {
    callWithRateLimitRetry,
    getAiErrorMessage,
    getAiErrorStatus,
    isAiRateLimitError,
} from '@/lib/aiProviderErrors';
import { NextResponse } from "next/server";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

const parseJsonReply = parseAutofillJson;

async function loadImageFromUrl(imageUrl) {
    const url = String(imageUrl || '').trim();
    if (!/^https?:\/\//i.test(url)) {
        throw new Error('Invalid image URL');
    }

    const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
    if (!response.ok) {
        throw new Error(`Could not load product image (${response.status})`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length > MAX_IMAGE_BYTES) {
        throw new Error('Image is too large for AI autofill. Use an image under 8MB.');
    }

    const mimeType = String(response.headers.get('content-type') || 'image/jpeg')
        .split(';')[0]
        .trim()
        .toLowerCase();

    if (!mimeType.startsWith('image/')) {
        throw new Error('The selected media URL is not an image.');
    }

    return {
        base64Image: buffer.toString('base64'),
        mimeType,
    };
}

function normalizeBase64Input(base64Image, mimeType) {
    const normalizedMime = String(mimeType || 'image/jpeg').split(';')[0].trim().toLowerCase();
    const normalizedBase64 = String(base64Image || '').trim();

    if (!normalizedBase64 || !normalizedMime.startsWith('image/')) {
        throw new Error('A valid product image is required for AI autofill.');
    }

    const estimatedBytes = Math.ceil((normalizedBase64.length * 3) / 4);
    if (estimatedBytes > MAX_IMAGE_BYTES) {
        throw new Error('Image is too large for AI autofill. Upload a smaller image and try again.');
    }

    return {
        base64Image: normalizedBase64,
        mimeType: normalizedMime,
    };
}

async function callOpenAIWithRetry(fn, maxRetries = 3) {
    return callWithRateLimitRetry(fn, { maxRetries, baseDelayMs: 2000 });
}

async function runOpenAIAutofill(base64Image, mimeType, additionalContext, includeArabic, storeCategories) {
    return main(base64Image, mimeType, additionalContext, includeArabic, storeCategories);
}

async function runGeminiAutofill(base64Image, mimeType, additionalContext, includeArabic, storeCategories) {
    return generateProductAutofillFromImage({
        base64Image,
        mimeType,
        additionalContext,
        includeArabic,
        storeCategories,
    });
}

async function runProductAutofill({
    base64Image,
    mimeType,
    additionalContext,
    includeArabic,
    storeCategories,
}) {
    const preferGemini = shouldUseGeminiForProducts();
    const geminiReady = isGeminiConfigured();
    const openaiReady = isOpenAIConfigured();
    const allowFallback = String(process.env.PRODUCT_AI_FALLBACK || 'true').trim().toLowerCase() !== 'false';

    const providers = [];
    if (preferGemini && geminiReady) providers.push('gemini');
    if (!preferGemini && openaiReady) providers.push('openai');
    if (allowFallback) {
        if (preferGemini && openaiReady && !providers.includes('openai')) providers.push('openai');
        if (!preferGemini && geminiReady && !providers.includes('gemini')) providers.push('gemini');
    }

    if (providers.length === 0) {
        throw Object.assign(new Error('AI is disabled (set GEMINI_API_KEY or OPENAI_API_KEY)'), { status: 503 });
    }

    const errors = [];

    for (const provider of providers) {
        try {
            const result = provider === 'gemini'
                ? await runGeminiAutofill(base64Image, mimeType, additionalContext, includeArabic, storeCategories)
                : await runOpenAIAutofill(base64Image, mimeType, additionalContext, includeArabic, storeCategories);

            return { ...result, provider, attemptedProviders: providers };
        } catch (error) {
            errors.push({ provider, error });
            if (!allowFallback || !isAiRateLimitError(error)) {
                throw Object.assign(error, {
                    provider,
                    attemptedProviders: providers,
                });
            }
        }
    }

    const last = errors[errors.length - 1];
    throw Object.assign(last?.error || new Error('AI autofill failed'), {
        provider: last?.provider,
        attemptedProviders: providers,
        allRateLimited: errors.every((entry) => isAiRateLimitError(entry.error)),
    });
}

async function main(base64Image, mimeType, additionalContext = '', includeArabic = false, storeCategories = []) {
    const categoryNames = storeCategories
        .map((category) => String(category?.name || '').trim())
        .filter(Boolean)
        .slice(0, 120);

    const categoryHint = categoryNames.length > 0
        ? `Pick 1-3 best matching categories ONLY from this store list: ${categoryNames.join(', ')}`
        : 'Suggest 1-3 practical ecommerce category names for this product.';

    const arabicSchema = includeArabic
        ? `,
                        "nameAr": string,
                        "brandAr": string,
                        "shortDescriptionAr": string,
                        "descriptionAr": string,
                        "descriptionOverviewAr": string,
                        "descriptionDetailsAr": string`
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
                        You are a senior ecommerce copywriter and product data specialist.
                        Analyze the product image carefully and produce accurate, detailed listing content.

                        Accuracy rules (critical):
                        - Only state facts you can clearly see in the image or that the seller explicitly provided.
                        - Do NOT invent model numbers, certifications, warranty periods, exact dimensions, battery capacity, or compatibility unless visible on packaging/labels or provided in seller context.
                        - If a spec is uncertain, omit it instead of guessing.
                        - Prefer practical shopper language over marketing fluff.

                        Content rules:
                        - Write a detailed English listing with rich product information.
                        - descriptionOverview: 2-3 sentences introducing the product.
                        - descriptionDetails: 1-2 paragraphs covering use cases, benefits, build/material cues, and what is visible in the image.
                        - features: 4-8 concise bullet points of real visible benefits.
                        - shortDescription: one compelling line for listing cards.
                        - shortDescription2: one extra highlight line.
                        - specTableRows: include 5-12 accurate rows when possible (type, material, color, connector/type, compatibility, length/size if visible, power/data support if visible, package contents if visible).
                        - suggestedCategories: choose only from the provided store category list when available.

                        Respond ONLY with raw JSON (no code block, no markdown, no explanation).
                        Schema:

                        {
                        "name": string,
                        "brand": string,
                        "shortDescription": string,
                        "shortDescription2": string,
                        "descriptionOverview": string,
                        "descriptionDetails": string,
                        "features": string[],
                        "suggestedCategories": string[],
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

                        Additional rules:
                        - Keep name concise and ecommerce-ready.
                        - Use exactly 2 spec columns: Property and Value.
                        - tags and seoKeywords: max 10 each, practical search terms only.
                        - If unsure about any field, return empty string or [] instead of guessing.
                            ${arabicRules}
                   `
        },
        {
            role: "user",
            content: [
                {
                    type: "text",
                    text: `Analyze this product image and generate complete listing fields. ${categoryHint}. Seller context: ${additionalContext || 'none'}`,
                },
                { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64Image}` } },
            ],
        },
    ];

    const response = await callOpenAIWithRetry(() => openai.chat.completions.create({
        model: process.env.OPENAI_PRODUCT_AUTOFILL_MODEL || process.env.OPENAI_MODEL || 'gpt-4o-mini',
        messages,
        temperature: 0.2,
    }));

    const raw = response.choices[0].message.content;
    const parsed = parseJsonReply(raw);
    return formatProductAutofillPayload(parsed, storeCategories, includeArabic);
}


export async function POST(request) {
    try {
        if (!isGeminiConfigured() && !isOpenAIConfigured()) {
            return NextResponse.json({ error: 'AI is disabled (set GEMINI_API_KEY or OPENAI_API_KEY)' }, { status: 503 });
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

        await connectDB();
        const storeCategories = await Category.find({}).select('_id name').sort({ name: 1 }).lean();

        const body = await request.json();
        const {
            base64Image,
            mimeType,
            imageUrl,
            additionalContext,
            includeArabic,
        } = body || {};

        let resolvedImage;
        if (imageUrl) {
            resolvedImage = await loadImageFromUrl(imageUrl);
        } else if (base64Image && mimeType) {
            resolvedImage = normalizeBase64Input(base64Image, mimeType);
        } else {
            return NextResponse.json(
                { error: 'Upload a product image first, then run AI autofill.' },
                { status: 400 }
            );
        }

        const result = await runProductAutofill({
            base64Image: resolvedImage.base64Image,
            mimeType: resolvedImage.mimeType,
            additionalContext: additionalContext || '',
            includeArabic: Boolean(includeArabic),
            storeCategories,
        });
        return NextResponse.json(result);
    } catch (error) {
        console.error('[API /store/ai]', error);
        const provider = error?.provider || (shouldUseGeminiForProducts() ? 'gemini' : 'openai');
        const safeStatus = getAiErrorStatus(error);
        const message = getAiErrorMessage(error, provider);

        return NextResponse.json(
            {
                error: message,
                provider,
                attemptedProviders: error?.attemptedProviders || [provider],
                retryable: safeStatus === 429,
            },
            {
                status: safeStatus,
                headers: safeStatus === 429 ? { 'Retry-After': '60' } : undefined,
            }
        );
    }
}
