import { supabase } from '../../../lib/supabase/client';
import type { CommentOrder, CommunityPage } from '../types';
import { CommunityRequestError, responseError } from './communityErrors';

const inFlight = new Map<string, Promise<CommunityPage>>();
export function subscribeCommunityIdentity(listener: () => void) {
  const subscription = supabase?.auth.onAuthStateChange((event) => {
    // Never await SDK methods while Auth holds its callback lock.
    if (event !== 'INITIAL_SESSION') queueMicrotask(listener);
  }).data.subscription;
  return () => subscription?.unsubscribe();
}
export async function communityRead(chapter: number, cursor: string | null = null, order: CommentOrder = 'asc'): Promise<CommunityPage> {
  const base = import.meta.env.VITE_SUPABASE_URL?.trim();
  if (!base || !supabase) throw new CommunityRequestError('A comunidade está indisponível no momento.', 'unavailable');
  // Recovery only, never creates identities. Tokens remain inside this service.
  const { data, error } = await supabase.auth.getSession().catch(() => {
    throw new CommunityRequestError('Não foi possível recuperar sua sessão. Tente novamente.', 'unauthorized');
  });
  if (error) throw new CommunityRequestError('Não foi possível recuperar sua sessão. Tente novamente.', 'unauthorized');
  const token = data.session?.access_token;
  const key = JSON.stringify([chapter, cursor, order, token ?? null]);
  const pending = inFlight.get(key);
  if (pending) return pending;
  const request = (async () => {
    try {
      const url = new URL(`${base}/functions/v1/community-read`);
      url.searchParams.set('chapter', String(chapter));
      url.searchParams.set('order', order);
      if (cursor) url.searchParams.set('cursor', cursor);
      const response = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}, signal: AbortSignal.timeout(15000),
      });
      const result = await response.json();
      if (!response.ok) throw responseError(response.status, result.error?.code, null);
      if (result.chapter_number !== chapter || !Array.isArray(result.comments) ||
        !Number.isSafeInteger(result.clover_count) || result.clover_count < 0 ||
        typeof result.has_left_clover !== 'boolean' ||
        (result.next_cursor !== null && typeof result.next_cursor !== 'string') ||
        result.comments.some((row: Record<string, unknown>) => !row ||
          ['id','pseudonym','body','created_at'].some((field) => typeof row[field] !== 'string') ||
          !Number.isFinite(Date.parse(String(row.created_at))))) {
        throw new Error('Invalid public response');
      }
      return result as CommunityPage;
    } catch (cause) {
      if (cause instanceof CommunityRequestError) throw cause;
      throw new CommunityRequestError('Não foi possível carregar a conversa. Tente novamente.', 'unavailable');
    }
  })();
  inFlight.set(key, request);
  try { return await request; } finally { inFlight.delete(key); }
}
