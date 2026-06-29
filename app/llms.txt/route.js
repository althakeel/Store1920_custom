import { buildLlmsTxt, llmsResponseHeaders } from '@/lib/llmsTxt';

// Next.js requires a static literal for route segment config (see lib/llmsTxt.js LLMS_REVALIDATE_SECONDS).
export const revalidate = 3600;

export async function GET() {
  const body = await buildLlmsTxt();
  return new Response(body, { headers: llmsResponseHeaders() });
}
