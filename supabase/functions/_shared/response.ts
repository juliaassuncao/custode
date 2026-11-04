import { corsHeaders } from './cors.ts';

export function jsonResponse(body: unknown, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      ...headers,
    },
  });
}

export function errorResponse(status: number, code: string, message: string, headers = {}) {
  return jsonResponse({ error: { code, message } }, status, headers);
}
