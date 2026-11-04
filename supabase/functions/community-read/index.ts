import { corsHeaders } from '../_shared/cors.ts';
import { errorResponse, jsonResponse } from '../_shared/response.ts';
import { encodeCursor, InvalidParameters, parseReadParameters } from '../_shared/validation.ts';

// Only these fields may cross the public response boundary.
type PublicComment = { id: string; pseudonym: string; body: string; created_at: string };

export async function handleRequest(request: Request): Promise<Response> {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (request.method !== 'GET') {
    return errorResponse(405, 'method_not_allowed', 'Use GET.', { Allow: 'GET, OPTIONS' });
  }

  try {
    const { chapter, limit, cursor, order } = parseReadParameters(new URL(request.url));
    const baseUrl = Deno.env.get('SUPABASE_URL');
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!baseUrl || !key) throw new Error('Missing server configuration');

    // Optional personalization. Public reads still need no session or API key.
    // Only Auth's verified user ID may be used for the viewer's clover lookup.
    let viewerId: string | null = null;
    const authorization = request.headers.get('authorization');
    if (authorization !== null) {
      if (!/^Bearer [A-Za-z0-9_.-]+$/i.test(authorization) || authorization.length > 16384) {
        return errorResponse(401, 'unauthorized', 'Sessão inválida ou expirada.');
      }
      const auth = await fetch(new URL('/auth/v1/user', baseUrl), {
        headers: { apikey: key, Authorization: authorization }, signal: AbortSignal.timeout(10000),
      });
      if (auth.status === 401 || auth.status === 403) {
        return errorResponse(401, 'unauthorized', 'Sessão inválida ou expirada.');
      }
      if (!auth.ok) throw new Error('Auth unavailable');
      const user = await auth.json();
      if (user.role !== 'authenticated' || typeof user.id !== 'string' ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(user.id)) {
        return errorResponse(401, 'unauthorized', 'Sessão inválida ou expirada.');
      }
      viewerId = user.id;
    }

    // Native fetch keeps this function dependency-free. Never forward caller headers.
    async function read(table: string, params: Record<string, string>, countOnly = false) {
      const url = new URL(`/rest/v1/${table}`, baseUrl);
      url.search = new URLSearchParams(params).toString();
      const response = await fetch(url, {
        method: countOnly ? 'HEAD' : 'GET',
        headers: {
          apikey: key!,
          Authorization: `Bearer ${key}`,
          ...(countOnly ? { Prefer: 'count=exact' } : {}),
        },
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) throw new Error('Database read failed');
      return response;
    }

    const chapterResponse = await read('community_chapters', {
      select: 'chapter_number', chapter_number: `eq.${chapter}`, enabled: 'eq.true', limit: '1',
    });
    if ((await chapterResponse.json()).length === 0) {
      return errorResponse(404, 'chapter_not_found', 'Capítulo indisponível.');
    }

    const filters: Record<string, string> = {
      select: 'id,pseudonym,body,created_at',
      chapter_number: `eq.${chapter}`,
      status: 'eq.published',
      order: `created_at.${order},id.${order}`,
      limit: String(limit + 1),
    };
    // Tuple comparison (created_at, id) > cursor, including timestamp ties.
    if (cursor) {
      const comparison = order === 'asc' ? 'gt' : 'lt';
      filters.or = `(created_at.${comparison}.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.${comparison}.${cursor.id}))`;
    }
    const [commentsResponse, cloversResponse, viewerCloverResponse] = await Promise.all([
      read('comments', filters),
      read('chapter_clovers', { select: 'chapter_number', chapter_number: `eq.${chapter}` }, true),
      viewerId ? read('chapter_clovers', { select: 'chapter_number', chapter_number: `eq.${chapter}`,
        user_id: `eq.${viewerId}`, limit: '1' }) : Promise.resolve(null),
    ]);
    const rows: PublicComment[] = await commentsResponse.json();
    const total = cloversResponse.headers.get('content-range')?.split('/')[1];
    if (!total || !/^\d+$/.test(total) || !Number.isSafeInteger(Number(total))) {
      throw new Error('Invalid count');
    }
    const comments = rows.slice(0, limit).map(({ id, pseudonym, body, created_at }) =>
      ({ id, pseudonym, body, created_at }));
    return jsonResponse({
      chapter_number: chapter,
      comments,
      clover_count: Number(total),
      has_left_clover: viewerCloverResponse ? (await viewerCloverResponse.json()).length > 0 : false,
      next_cursor: rows.length > limit ? encodeCursor(chapter, comments[comments.length - 1], order) : null,
    });
  } catch (error) {
    if (error instanceof InvalidParameters) {
      return errorResponse(400, 'invalid_parameters', 'Parâmetros inválidos.');
    }
    // Do not expose PostgreSQL errors, credentials, request cursors or stack traces.
    return errorResponse(500, 'internal_error', 'Não foi possível carregar a comunidade.');
  }
}

Deno.serve(handleRequest);
