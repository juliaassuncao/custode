import { useCallback, useEffect, useRef, useState } from 'react';
import type { CommentOrder, CommunityPage } from '../types';
import { communityRead, subscribeCommunityIdentity } from '../services/communityRead';

type State = Omit<CommunityPage, 'chapter_number'> & { order: CommentOrder; ready: boolean; loading: boolean; error: string };
const initial: State = { comments: [], clover_count: 0, has_left_clover: false, next_cursor: null,
  order: 'asc', ready: false, loading: true, error: '' };
export function useChapterCommunity(chapter: number, order: CommentOrder = 'asc') {
  const [state, setState] = useState(initial);
  const latest = useRef(state);
  latest.current = state;
  const version = useRef(0);
  const inFlight = useRef(false);
  const lastReset = useRef(true);
  const load = useCallback(async (reset = false) => {
    if (!reset && (inFlight.current || !latest.current.next_cursor)) return;
    inFlight.current = true;
    lastReset.current = reset;
    const requestVersion = ++version.current;
    const cursor = reset ? null : latest.current.next_cursor;
    setState((old) => ({ ...old, ...(old.order !== order ? { comments: [], next_cursor: null, ready: false } : {}), order, loading: true, error: '' }));
    try {
      const page = await communityRead(chapter, cursor, order);
      if (requestVersion !== version.current) return;
      setState((old) => {
        const existing = reset ? [] : old.comments;
        const ids = new Set(existing.map((row) => row.id));
        return { ...page, order, comments: [...existing, ...page.comments.filter((row) => !ids.has(row.id))],
          ready: true, loading: false, error: '' };
      });
    } catch (cause) {
      if (requestVersion === version.current) setState((old) => ({ ...old, loading: false,
        error: cause instanceof Error ? cause.message : 'Não foi possível carregar a conversa.' }));
    } finally { if (requestVersion === version.current) inFlight.current = false; }
  }, [chapter, order]);
  useEffect(() => {
    void load(true);
    let mounted = true;
    const unsubscribe = subscribeCommunityIdentity(() => {
      if (mounted) {
        setState((old) => ({ ...old, ready: false }));
        void load(true);
      }
    });
    return () => { mounted = false; unsubscribe(); version.current++; };
  }, [load]);
  function confirmClover(count: number) {
    // Discard reads begun before this confirmed write; retain pagination position.
    version.current++; inFlight.current = false;
    setState((old) => ({ ...old, has_left_clover: true, clover_count: count, ready: true, loading: false, error: '' }));
  }
  return { ...state, load, confirmClover, retry: () => load(lastReset.current) };
}
