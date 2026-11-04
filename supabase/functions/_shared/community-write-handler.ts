import { corsHeaders } from './cors.ts';
import { errorResponse, jsonResponse } from './response.ts';
import { parseWrite, readWriteBody, WriteError } from './write-validation.ts';

const cors = { ...corsHeaders, 'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Expose-Headers': 'Retry-After' };
const messages: Record<string, string> = {
  unauthorized: 'Sessão inválida ou expirada.',
  invalid_parameters: 'Parâmetros inválidos.',
  captcha_failed: 'Conclua um novo desafio de segurança.',
  chapter_not_found: 'Capítulo indisponível.',
  comment_not_found: 'Comentário indisponível.',
  idempotency_conflict: 'Este envio já foi usado com outro conteúdo.',
  rate_limited: 'Limite de frequência atingido. Aguarde antes de tentar novamente.',
  method_not_allowed: 'Use POST.',
  unsupported_media_type: 'Envie JSON.',
  payload_too_large: 'Requisição muito grande.',
  service_unavailable: 'Não foi possível confirmar a operação. Reenvie com o mesmo identificador e um novo desafio.',
};

// Dependencies are injectable only in isolated tests; production has no test flag/bypass.
export function createCommunityWriteHandler(deps: {
  env(name: string): string | undefined;
  fetch: typeof fetch;
}) {
  return async (request: Request): Promise<Response> => {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    try {
      if (request.method !== 'POST') throw new WriteError(405, 'method_not_allowed');
      if (new URL(request.url).search) throw new WriteError(400, 'invalid_parameters');
      const authorization = request.headers.get('authorization');
      if (!authorization || !/^Bearer [A-Za-z0-9_.-]+$/i.test(authorization) || authorization.length > 16384) {
        throw new WriteError(401, 'unauthorized');
      }
      const url = deps.env('SUPABASE_URL');
      const serviceKey = deps.env('SUPABASE_SERVICE_ROLE_KEY');
      // SUPABASE_* custom names are reserved and skipped by `functions serve`.
      // Provision independently in the Edge runtime; never read Auth container/files.
      const secret = deps.env('TURNSTILE_SECRET_KEY');
      if (!url || !serviceKey || !secret) throw new WriteError(503, 'service_unavailable');
      // Auth validates the JWT; never trust a decoded payload or a caller's user ID.
      const auth = await deps.fetch(new URL('/auth/v1/user', url), {
        headers: { apikey: serviceKey, Authorization: authorization }, signal: AbortSignal.timeout(10000),
      });
      if (auth.status === 401 || auth.status === 403) throw new WriteError(401, 'unauthorized');
      if (!auth.ok) throw new WriteError(503, 'service_unavailable');
      const user = await auth.json();
      if (typeof user.id !== 'string' || !/^[0-9a-f-]{36}$/i.test(user.id) || user.role !== 'authenticated') {
        throw new WriteError(401, 'unauthorized');
      }
      const command = parseWrite(await readWriteBody(request));
      const verification = await deps.fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        body: new URLSearchParams({ secret, response: command.captcha_token }),
        signal: AbortSignal.timeout(10000),
      });
      if (!verification.ok) throw new WriteError(503, 'service_unavailable');
      const proof = await verification.json();
      if (proof.success !== true) {
        const codes = Array.isArray(proof['error-codes']) ? proof['error-codes'] : [];
        if (codes.some((code: unknown) => ['missing-input-secret','invalid-input-secret','internal-error'].includes(String(code)))) {
          throw new WriteError(503, 'service_unavailable');
        }
        throw new WriteError(403, 'captcha_failed');
      }
      // No remoteip is sent or stored. Every RPC call follows a fresh successful Siteverify.
      const rpc = await deps.fetch(new URL('/rest/v1/rpc/community_mutate', url), {
        method: 'POST',
        headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_actor: user.id, p_operation: command.operation, p_input: command.input }),
        signal: AbortSignal.timeout(15000),
      });
      if (!rpc.ok) throw new WriteError(503, 'service_unavailable');
      const result = await rpc.json();
      if (result.error) {
        const statuses: Record<string, number> = { unauthorized:401, invalid_parameters:400,
          chapter_not_found:404, comment_not_found:404, idempotency_conflict:409, rate_limited:429 };
        if (!statuses[result.error]) throw new WriteError(503, 'service_unavailable');
        throw new WriteError(statuses[result.error], result.error,
          result.error === 'rate_limited' ? result.retry_after : undefined);
      }
      // Response allowlist; never forward backend rows, actor IDs or report internals.
      const data = command.operation === 'comment'
        ? { comment_id: result.comment_id, created_at: result.created_at, replayed: result.replayed }
        : command.operation === 'clover'
        ? { clover_count: result.clover_count, already_left: result.already_left }
        : { reported: result.reported, already_reported: result.already_reported };
      return jsonResponse({ operation: command.operation, ...data }, 200, cors);
    } catch (error) {
      const failure = error instanceof WriteError ? error : new WriteError(503, 'service_unavailable');
      const headers: Record<string, string> = { ...cors };
      if (failure.status === 405) headers.Allow = 'POST, OPTIONS';
      if (Number.isInteger(failure.retryAfter) && failure.retryAfter! > 0) headers['Retry-After'] = String(failure.retryAfter);
      return errorResponse(failure.status, failure.code, messages[failure.code] ?? messages.service_unavailable, headers);
    }
  };
}
