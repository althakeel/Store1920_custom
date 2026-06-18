import authSeller from '@/middlewares/authSeller';
import { getProductAiRuntimeConfig } from '@/lib/productAiConfig';
import { NextResponse } from 'next/server';

export async function GET(request) {
  try {
    const authHeader = request.headers.get('authorization');
    let userId = null;

    if (authHeader?.startsWith('Bearer ')) {
      const idToken = authHeader.split('Bearer ')[1];
      try {
        const { getAuth } = await import('@/lib/firebase-admin');
        const adminAuth = getAuth();
        const decodedToken = await adminAuth.verifyIdToken(idToken);
        userId = decodedToken.uid;
      } catch (error) {
        return NextResponse.json({ error: 'Auth verification failed', detail: error.message }, { status: 401 });
      }
    }

    const storeId = await authSeller(userId);
    if (!storeId) {
      return NextResponse.json({ error: 'not authorized' }, { status: 401 });
    }

    const runtime = getProductAiRuntimeConfig();

    return NextResponse.json({
      ...runtime,
      serverBuild: 'ai-status-v2',
      help: [
        'If you changed API keys, redeploy or restart the Node server on AWS.',
        'Set PRODUCT_AI_PROVIDER=openai to force OpenAI when Gemini quota is exhausted.',
        'A new Gemini key in the same Google project still shares the same quota.',
      ],
    });
  } catch (error) {
    return NextResponse.json(
      { error: error?.message || 'Failed to read AI configuration' },
      { status: 500 }
    );
  }
}
