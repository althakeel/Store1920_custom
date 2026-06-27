import { buildLlmsTxt, llmsResponseHeaders, LLMS_REVALIDATE_SECONDS } from '@/lib/llmsTxt';

export const revalidate = LLMS_REVALIDATE_SECONDS;

export async function GET() {
  const body = await buildLlmsTxt();
  return new Response(body, { headers: llmsResponseHeaders() });
}
