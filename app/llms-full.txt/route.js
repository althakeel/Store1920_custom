import { buildLlmsFullTxt, llmsResponseHeaders, LLMS_REVALIDATE_SECONDS } from '@/lib/llmsTxt';

export const revalidate = LLMS_REVALIDATE_SECONDS;

export async function GET() {
  const body = await buildLlmsFullTxt();
  return new Response(body, { headers: llmsResponseHeaders() });
}
