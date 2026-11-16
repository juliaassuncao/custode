import { supabase } from '../../../lib/supabase/client';
import type { CommentOrder, CommunityPage, NumberedCommunityPage } from '../types';
import { CommunityRequestError, responseError } from './communityErrors';

const inFlight = new Map<string, Promise<CommunityPage>>();
export function subscribeCommunityIdentity(listener: () => void) {
  const subscription = supabase?.auth.onAuthStateChange((event) => {
    // Never await SDK methods while Auth holds its callback lock.
    if (event !== 'INITIAL_SESSION') queueMicrotask(listener);
  }).data.subscription;
  return () => subscription?.unsubscribe();
}
export function communityRead(chapter: number, page: number, order?: CommentOrder, refresh?: boolean): Promise<NumberedCommunityPage>;
export function communityRead(chapter: number, cursor?: string | null, order?: CommentOrder): Promise<CommunityPage>;
export async function communityRead(chapter: number, cursorOrPage: string | number | null = null, order: CommentOrder = 'asc', refresh = false): Promise<CommunityPage> {
  const page = typeof cursorOrPage === 'number' ? cursorOrPage : null;
  const cursor = typeof cursorOrPage === 'string' ? cursorOrPage : null;
  if (page !== null && (!Number.isSafeInteger(page) || page < 1 || page > 2147483647)) {
    throw new CommunityRequestError('Não foi possível carregar a conversa. Tente novamente.', 'invalid_parameters');
  }
  const base = import.meta.env.VITE_SUPABASE_URL?.trim();
  if (!base || !supabase) throw new CommunityRequestError('A comunidade está indisponível no momento.', 'unavailable');
  // Recovery only, never creates identities. Tokens remain inside this service.
  const { data, error } = await supabase.auth.getSession().catch(() => {
    throw new CommunityRequestError('Não foi possível recuperar sua sessão. Tente novamente.', 'unauthorized');
  });
  if (error) throw new CommunityRequestError('Não foi possível recuperar sua sessão. Tente novamente.', 'unauthorized');
  const token = data.session?.access_token;
  const key = JSON.stringify([chapter, cursor, page, order, token ?? null]);
  const pending = inFlight.get(key);
  // A confirmed publication must not reuse a read that began before the write.
  if (pending && !refresh) return pending;
  const request = (async () => {
    try {
      const url = new URL(`${base}/functions/v1/community-read`);
      url.searchParams.set('chapter', String(chapter));
      url.searchParams.set('order', order);
      if (page !== null) {
        url.searchParams.set('page', String(page));
        url.searchParams.set('limit', '10');
      }
      if (cursor) url.searchParams.set('cursor', cursor);
      const response = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}, signal: AbortSignal.timeout(15000),
      });
      const result = await response.json();
      if (!response.ok) throw responseError(response.status, result.error?.code, null, 'read');
      if (result.chapter_number !== chapter || !Array.isArray(result.comments) ||
        !Number.isSafeInteger(result.clover_count) || result.clover_count < 0 ||
        typeof result.has_left_clover !== 'boolean' ||
        (result.next_cursor !== null && typeof result.next_cursor !== 'string') ||
        result.comments.some((row: Record<string, unknown>) => !row ||
          ['id','pseudonym','body','created_at'].some((field) => typeof row[field] !== 'string') ||
          !Number.isFinite(Date.parse(String(row.created_at))))) {
        throw new Error('Invalid public response');
      }
      if (page !== null && (!Number.isSafeInteger(result.total_count) || result.total_count < 0 ||
        result.limit !== 10 || result.total_pages !== Math.max(1, Math.ceil(result.total_count / 10)) ||
        result.page !== Math.min(page, result.total_pages) || result.comments.length > 10)) {
        throw new Error('Invalid numbered page');
      }
      return result as CommunityPage;
    } catch (cause) {
      if (cause instanceof CommunityRequestError) throw cause;
      throw new CommunityRequestError('Não foi possível carregar a conversa. Tente novamente.', 'unavailable');
    }
  })();
  inFlight.set(key, request);
  try { return await request; } finally { if (inFlight.get(key) === request) inFlight.delete(key); }
}
