import { corsHeaders } from './cors.ts';
import { errorResponse, jsonResponse } from './response.ts';
import { readWriteBody, WriteError } from './write-validation.ts';

const cors = { ...corsHeaders, 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const messages: Record<string, string> = {
  unauthorized: 'Sessão inválida ou expirada.', forbidden: 'Acesso administrativo não autorizado.',
  invalid_parameters: 'Parâmetros inválidos.', not_found: 'Registro indisponível.',
  state_conflict: 'O registro foi alterado. Atualize os dados antes de tentar novamente.',
  idempotency_conflict: 'Identificador já utilizado por outra requisição.',
  service_unavailable: 'Não foi possível confirmar a operação. Repita com o mesmo identificador e conteúdo.',
  method_not_allowed: 'Use GET ou POST.', unsupported_media_type: 'Envie JSON.', payload_too_large: 'Requisição muito grande.',
};
function invalid(): never { throw new WriteError(400, 'invalid_parameters'); }

export function parseAdminMutation(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return invalid();
  const data = value as Record<string, unknown>;
  if (Object.keys(data).some(key => !['operation','target_id','request_id','expected_version','note'].includes(key)) ||
    !['hide_comment','restore_comment','resolve_report','dismiss_report'].includes(String(data.operation)) ||
    typeof data.target_id !== 'string' || !uuid.test(data.target_id) ||
    typeof data.request_id !== 'string' || !uuid.test(data.request_id) ||
    !Number.isInteger(data.expected_version) || Number(data.expected_version) < 0 || Number(data.expected_version) > 2147483646 ||
    (data.note !== undefined && (typeof data.note !== 'string' || data.note.includes('\0') || [...data.note.trim()].length > 2000)) ||
    (data.operation === 'hide_comment' && (typeof data.note !== 'string' || !data.note.trim()))) return invalid();
  return { operation: data.operation, target_id: data.target_id.toLowerCase(), request_id: data.request_id.toLowerCase(),
    expected_version: data.expected_version, ...(data.note !== undefined ? { note: (data.note as string).trim() } : {}) };
}

export function parseAdminRead(url: URL): Record<string, unknown> {
  const params = url.searchParams;
  for (const key of params.keys()) if (!['resource','status','chapter','limit','cursor'].includes(key) || params.getAll(key).length !== 1) invalid();
  const resource = params.get('resource');
  if (!resource || !['comments','reports','history'].includes(resource)) invalid();
  const input: Record<string, unknown> = { resource };
  if (params.has('status')) {
    const status = params.get('status')!;
    if (!(resource === 'comments' ? ['published','hidden','removed'] : resource === 'reports' ? ['open','resolved','dismissed'] : []).includes(status)) invalid();
    input.status = status;
  }
  for (const [key,max] of [['chapter',2147483647],['limit',50]] as const) {
    if (params.has(key)) {
      const raw = params.get(key)!;
      if (!/^[1-9][0-9]{0,9}$/.test(raw) || Number(raw) > max) invalid();
      input[key] = Number(raw);
    }
  }
  if (params.has('cursor')) {
    const raw = params.get('cursor')!;
    if (!/^[A-Za-z0-9_-]{1,1024}$/.test(raw)) invalid();
    try { input.cursor = JSON.parse(atob(raw.replace(/-/g,'+').replace(/_/g,'/'))); } catch { invalid(); }
    // PostgreSQL validates the complete cursor and its filter scope.
  }
  return input;
}

export function createCommunityAdminHandler(deps: { env(name: string): string | undefined; fetch: typeof fetch }) {
  return async (request: Request): Promise<Response> => {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    try {
      if (!['GET','POST'].includes(request.method)) throw new WriteError(405,'method_not_allowed');
      const authorization = request.headers.get('authorization');
      if (!authorization || !/^Bearer [A-Za-z0-9_.-]+$/i.test(authorization) || authorization.length > 16384) throw new WriteError(401,'unauthorized');
      const base = deps.env('SUPABASE_URL'), key = deps.env('SUPABASE_SERVICE_ROLE_KEY');
      if (!base || !key) throw new WriteError(503,'service_unavailable');
      const auth = await deps.fetch(new URL('/auth/v1/user',base), {
        headers: { apikey: key, Authorization: authorization }, signal: AbortSignal.timeout(10000),
      });
      if ([401,403].includes(auth.status)) throw new WriteError(401,'unauthorized');
      if (!auth.ok) throw new WriteError(503,'service_unavailable');
      const user = await auth.json();
      if (typeof user.id !== 'string' || !uuid.test(user.id) || user.role !== 'authenticated') throw new WriteError(401,'unauthorized');
      if (user.is_anonymous !== false) throw new WriteError(403,'forbidden');
      const url = new URL(request.url);
      if (request.method === 'POST' && url.search) invalid();
      const input = request.method === 'GET' ? parseAdminRead(url) : parseAdminMutation(await readWriteBody(request));
      // Both RPCs revalidate active membership and non-anonymous Auth identity,
      // holding shared locks until the transaction ends. No caller identity is forwarded.
      const rpc = await deps.fetch(new URL(`/rest/v1/rpc/community_admin_${request.method === 'GET' ? 'read' : 'mutate'}`,base), {
        method: 'POST', headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_actor: user.id, p_input: input }), signal: AbortSignal.timeout(15000),
      });
      if ([401,403].includes(rpc.status)) throw new WriteError(403,'forbidden');
      if (!rpc.ok) throw new WriteError(503,'service_unavailable');
      const result = await rpc.json();
      if (result.error) {
        const statuses: Record<string,number> = { invalid_parameters:400, not_found:404, state_conflict:409, idempotency_conflict:409 };
        throw new WriteError(statuses[result.error] ?? 503, statuses[result.error] ? result.error : 'service_unavailable');
      }
      if (request.method === 'GET') {
        if (!Array.isArray(result.items)) throw new WriteError(503,'service_unavailable');
        const cursor = result.next_cursor === null ? null : btoa(JSON.stringify(result.next_cursor)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
        return jsonResponse({ items: result.items, next_cursor: cursor },200,cors);
      }
      return jsonResponse({ audit_id: result.audit_id, target_id: result.target_id, state: result.state, replayed: result.replayed },200,cors);
    } catch (error) {
      const failure = error instanceof WriteError ? error : new WriteError(503,'service_unavailable');
      return errorResponse(failure.status,failure.code,messages[failure.code] ?? messages.service_unavailable,
        { ...cors, ...(failure.status === 405 ? { Allow: 'GET, POST, OPTIONS' } : {}) });
    }
  };
}
