import { useCallback, useEffect, useRef, useState } from 'react';
import type { CommentOrder, NumberedCommunityPage } from '../types';
import { communityRead, subscribeCommunityIdentity } from '../services/communityRead';

type State = NumberedCommunityPage & { order: CommentOrder; ready: boolean; loading: boolean; error: string };
const initial: Omit<State, 'chapter_number' | 'order'> = {
  comments: [], clover_count: 0, has_left_clover: false, next_cursor: null,
  page: 1, limit: 10, total_count: 0, total_pages: 1, ready: false, loading: true, error: '',
};
export function useChapterCommunity(chapter: number, order: CommentOrder = 'asc') {
  const [state, setState] = useState<State>({ ...initial, chapter_number: chapter, order });
  const latest = useRef(state);
  latest.current = state;
  const version = useRef(0);
  const inFlight = useRef(false);
  const lastPage = useRef(1);
  const loadPage = useCallback(async (requestedPage: number, refresh = false) => {
    inFlight.current = true;
    lastPage.current = requestedPage;
    const requestVersion = ++version.current;
    setState((old) => ({ ...old,
      ...(old.chapter_number !== chapter ? initial : old.order !== order
        ? { comments: [], next_cursor: null, page: 1, total_count: 0, total_pages: 1, ready: false } : {}),
      chapter_number: chapter, order, loading: true, error: '' }));
    try {
      const page = await communityRead(chapter, requestedPage, order, refresh);
      if (requestVersion !== version.current) return false;
      lastPage.current = page.page;
      setState({ ...page, order, ready: true, loading: false, error: '' });
      return true;
    } catch (cause) {
      if (requestVersion === version.current) setState((old) => ({ ...old, loading: false,
        error: cause instanceof Error ? cause.message : 'Não foi possível carregar a conversa.' }));
      return false;
    } finally { if (requestVersion === version.current) inFlight.current = false; }
  }, [chapter, order]);
  useEffect(() => {
    void loadPage(1);
    let mounted = true;
    const unsubscribe = subscribeCommunityIdentity(() => {
      if (mounted) {
        setState((old) => ({ ...old, ready: false }));
        // Session personalization refreshes the current page instead of restarting the list.
        const current = latest.current;
        void loadPage(current.chapter_number === chapter && current.order === order ? current.page : 1);
      }
    });
    return () => { mounted = false; unsubscribe(); version.current++; };
  }, [loadPage]);
  function load(reset = false) {
    return loadPage(reset ? 1 : latest.current.page, true);
  }
  function goToPage(page: number) {
    if (inFlight.current || page === latest.current.page || !Number.isSafeInteger(page) ||
      page < 1 || page > latest.current.total_pages) return Promise.resolve(false);
    return loadPage(page);
  }
  function confirmClover(count: number) {
    // Discard reads begun before this confirmed write; retain pagination position.
    version.current++; inFlight.current = false;
    setState((old) => ({ ...old, has_left_clover: true, clover_count: count, ready: true, loading: false, error: '' }));
  }
  return { ...state, load, goToPage, confirmClover, retry: () => loadPage(lastPage.current) };
}
