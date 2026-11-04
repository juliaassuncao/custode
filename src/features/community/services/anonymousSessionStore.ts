import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { consumeCaptchaToken } from './captchaTokens';

type Auth = Pick<SupabaseClient['auth'],
  'getSession' | 'refreshSession' | 'signInAnonymously' | 'onAuthStateChange'>;
export type SessionErrorCode = 'unavailable' | 'captcha_required' | 'session_failed' | 'non_anonymous_session';
export type AnonymousSessionState =
  | { status: 'idle' | 'loading' | 'authenticated'; error: null }
  | { status: 'error'; error: { code: SessionErrorCode; message: string } };

const messages: Record<SessionErrorCode, string> = {
  unavailable: 'A participação está indisponível no momento.',
  captcha_required: 'Conclua uma nova verificação de segurança.',
  session_failed: 'Não foi possível recuperar ou criar sua sessão. Tente novamente.',
  non_anonymous_session: 'A sessão atual não é anônima. Ela foi preservada.',
};

class SessionFailure extends Error {
  constructor(readonly code: SessionErrorCode) { super(messages[code]); }
}

// Factory permits isolated tests. The application exports one shared instance.
export function createAnonymousSessionStore(auth: Auth | null) {
  let state: AnonymousSessionState = { status: 'idle', error: null };
  const listeners = new Set<() => void>();
  let inFlight: Promise<void> | null = null;
  let subscription: { unsubscribe(): void } | null = null;
  let expiryTimer: ReturnType<typeof setTimeout> | undefined;
  let generation = 0;
  let watching = false;

  function set(next: AnonymousSessionState) {
    state = next;
    listeners.forEach((listener) => listener());
  }
  function fail(code: SessionErrorCode) {
    set({ status: 'error', error: { code, message: messages[code] } });
    return new Error(messages[code]);
  }
  function valid(session: Session | null): session is Session {
    return !!session && session.user.is_anonymous === true &&
      typeof session.expires_at === 'number' && session.expires_at * 1000 > Date.now();
  }
  function reflect(session: Session | null) {
    clearTimeout(expiryTimer);
    if (session && session.user.is_anonymous !== true) {
      fail('non_anonymous_session');
    } else if (valid(session)) {
      set({ status: 'authenticated', error: null });
      if (watching) {
        expiryTimer = setTimeout(() => { void restore(); },
          Math.min(session.expires_at! * 1000 - Date.now() + 50, 2_147_483_647));
      }
    } else {
      set({ status: 'idle', error: null });
    }
  }
  async function existing(): Promise<Session | null> {
    if (!auth) throw new SessionFailure('unavailable');
    const result = await auth.getSession(); // SDK reads persistence and refreshes expired tokens.
    if (result.error) throw new SessionFailure('session_failed');
    let session = result.data.session;
    if (session && session.user.is_anonymous !== true) throw new SessionFailure('non_anonymous_session');
    if (session && !valid(session)) {
      const refreshed = await auth.refreshSession();
      if (refreshed.error || !valid(refreshed.data.session)) throw new SessionFailure('session_failed');
      session = refreshed.data.session;
    }
    return session;
  }
  async function restore() {
    const version = generation;
    try {
      const session = await existing();
      if (version === generation && !inFlight && watching) reflect(session);
    } catch (error) {
      if (version === generation && watching && !inFlight) {
        fail(error instanceof SessionFailure ? error.code : 'session_failed');
      }
    }
  }
  function subscribe(listener: () => void) {
    listeners.add(listener);
    if (!watching) {
      watching = true;
      if (auth) {
        subscription = auth.onAuthStateChange((_event, session) => {
          // Never await Auth methods inside this callback (SDK lock).
          generation++;
          reflect(session);
        }).data.subscription;
      }
      void restore(); // Recovery only: never signs up on mount/navigation.
    }
    return () => {
      listeners.delete(listener);
      if (!listeners.size) {
        watching = false;
        generation++;
        subscription?.unsubscribe();
        subscription = null;
        clearTimeout(expiryTimer);
      }
    };
  }

  function ensureSession(captchaToken?: string): Promise<void> {
    if (inFlight) return inFlight;
    generation++;
    set({ status: 'loading', error: null });
    const work = async () => {
      try {
        const session = await existing();
        if (session) { reflect(session); return; }
        if (!consumeCaptchaToken(captchaToken)) throw new SessionFailure('captcha_required');
        const result = await auth!.signInAnonymously({ options: { captchaToken } });
        if (result.error || !valid(result.data.session)) throw new SessionFailure('session_failed');
        reflect(result.data.session);
      } catch (error) {
        throw fail(error instanceof SessionFailure ? error.code : 'session_failed');
      }
    };
    // Cross-tab serialization when supported; always re-read storage inside the lock.
    const locked = () => typeof navigator !== 'undefined' && navigator.locks
      ? navigator.locks.request('custode-community-anonymous-session', work)
      : work();
    inFlight = Promise.resolve().then(locked).finally(() => { inFlight = null; });
    return inFlight;
  }
  return { getSnapshot: () => state, subscribe, ensureSession };
}
