import {
  handleOrderConfirmWebhookGet,
  handleOrderConfirmWebhookPost,
} from '@/lib/whatsapp/orderConfirmWebhook';

export async function GET() {
  return handleOrderConfirmWebhookGet();
}

export async function POST(request) {
  return handleOrderConfirmWebhookPost(request);
}
