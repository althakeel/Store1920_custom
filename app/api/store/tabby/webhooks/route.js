import { NextResponse } from 'next/server';
import authSeller from '@/middlewares/authSeller';
import { getAuth } from '@/lib/firebase-admin';
import {
    deleteTabbyWebhook,
    listTabbyWebhooks,
    registerTabbyWebhook,
    resolveTabbyWebhookUrl,
} from '@/lib/tabby';

async function verifyStoreSeller(request) {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
    }

    const idToken = authHeader.split('Bearer ')[1];
    let decodedToken;
    try {
        decodedToken = await getAuth().verifyIdToken(idToken);
    } catch {
        return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
    }

    const storeId = await authSeller(decodedToken.uid);
    if (!storeId) {
        return { error: NextResponse.json({ error: 'Not authorized' }, { status: 401 }) };
    }

    return { userId: decodedToken.uid };
}

export async function GET(request) {
    try {
        const auth = await verifyStoreSeller(request);
        if (auth.error) return auth.error;

        const webhooks = await listTabbyWebhooks();
        return NextResponse.json({
            ok: true,
            webhookUrl: resolveTabbyWebhookUrl(request),
            webhooks,
        });
    } catch (err) {
        console.error('[store/tabby/webhooks] GET failed:', err);
        return NextResponse.json({ error: err.message || 'Failed to list Tabby webhooks' }, { status: 500 });
    }
}

export async function POST(request) {
    try {
        const auth = await verifyStoreSeller(request);
        if (auth.error) return auth.error;

        const body = await request.json().catch(() => ({}));
        const webhook = await registerTabbyWebhook({
            url: body?.url,
            header: body?.header,
            request,
        });

        return NextResponse.json({
            ok: true,
            webhook,
            webhookUrl: webhook?.url || body?.url || resolveTabbyWebhookUrl(request),
        });
    } catch (err) {
        console.error('[store/tabby/webhooks] POST failed:', err);
        return NextResponse.json({ error: err.message || 'Failed to register Tabby webhook' }, { status: 500 });
    }
}

export async function DELETE(request) {
    try {
        const auth = await verifyStoreSeller(request);
        if (auth.error) return auth.error;

        const { searchParams } = new URL(request.url);
        const webhookId = searchParams.get('id');
        const result = await deleteTabbyWebhook(webhookId);

        return NextResponse.json({ ok: true, result });
    } catch (err) {
        console.error('[store/tabby/webhooks] DELETE failed:', err);
        return NextResponse.json({ error: err.message || 'Failed to delete Tabby webhook' }, { status: 500 });
    }
}
