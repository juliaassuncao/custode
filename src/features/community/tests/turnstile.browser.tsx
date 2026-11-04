// Development-only harness. Invoke runCommunityBrowserTests() through Vite in a browser.
// No real Cloudflare script, Supabase requests or secrets are used.
import { act, createRef, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { TurnstileChallenge, type TurnstileChallengeHandle } from '../components/TurnstileChallenge';
import { consumeCaptchaToken } from '../services/captchaTokens';
import { loadTurnstile, type TurnstileApi } from '../services/turnstileScript';
import { createAnonymousSessionStore } from '../services/anonymousSessionStore';
import { useAnonymousSession } from '../hooks/useAnonymousSession';

function check(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

export async function runCommunityBrowserTests() {
  const previousAct = (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  const previousApi = window.turnstile;
  const originalAppend = document.head.append;
  let options: Parameters<TurnstileApi['render']>[1] | undefined;
  let rendered = 0;
  let removed = 0;
  let scripts = 0;
  let observedToken: string | null = null;
  const ref = createRef<TurnstileChallengeHandle>();
  const api: TurnstileApi = {
    render: (_element, received) => { options = received; return String(++rendered); },
    remove: () => { removed++; },
  };
  const mount = () => root.render(<StrictMode><TurnstileChallenge ref={ref}
    onToken={(token) => { observedToken = token; }} /></StrictMode>);
  try {
    // Share one lazy script load, detect failure, and permit retry.
    delete window.turnstile;
    document.head.append = function (...nodes: (Node | string)[]) {
      for (const node of nodes) {
        if (node instanceof HTMLScriptElement && node.src.includes('challenges.cloudflare.com')) {
          scripts++;
          queueMicrotask(() => node.dispatchEvent(new Event('error')));
        } else originalAppend.apply(document.head, [node]);
      }
    };
    check(scripts === 0, 'Script loaded eagerly');
    const first = loadTurnstile();
    check(first === loadTurnstile(), 'Concurrent script requests not deduplicated');
    await first.catch(() => {});
    check(Number(scripts) === 1, 'Wrong script count');
    await act(async () => { mount(); });
    check(host.textContent?.includes('indisponível'), 'Missing script error feedback');
    check(observedToken === null, 'Token survived script failure');

    window.turnstile = api;
    await act(async () => { ref.current!.reset(); });
    check(rendered === 1, 'Retry did not render once');
    check(options, 'Widget options missing');
    await act(async () => { options!.callback('browser-proof-1'); });
    check(observedToken === 'browser-proof-1', 'Token callback failed');
    await act(async () => { options!['expired-callback'](); });
    check(observedToken === null && !consumeCaptchaToken('browser-proof-1'), 'Expired token remained usable');

    await act(async () => { ref.current!.reset(); });
    await act(async () => { options!.callback('browser-proof-2'); });
    await act(async () => { check(consumeCaptchaToken('browser-proof-2'), 'Fresh token rejected'); });
    check(observedToken === null && host.textContent?.includes('utilizada'), 'Spent token not cleared');
    check(!consumeCaptchaToken('browser-proof-2'), 'Token reused');
    await act(async () => { ref.current!.reset(); });
    await act(async () => { options!['error-callback'](); });
    check(host.textContent?.includes('indisponível') && observedToken === null, 'Widget error not handled');

    const stale = options!;
    await act(async () => { root.render(null); });
    await act(async () => { stale.callback('late-callback-after-unmount'); });
    check(observedToken === null && removed === rendered, 'Unmount leaked widget/token');
    await act(async () => { mount(); });
    // StrictMode runs setup/cleanup/setup; only the live asynchronous continuation renders.
    check(rendered - removed === 1, 'StrictMode leaked or duplicated a widget');
    await act(async () => { root.render(null); });
    check(removed === rendered, 'StrictMode cleanup leaked widget');

    // Pending script load must not render after StrictMode cleanup/unmount.
    delete window.turnstile;
    let pendingScript: HTMLScriptElement | undefined;
    document.head.append = function (...nodes: (Node | string)[]) {
      for (const node of nodes) {
        if (node instanceof HTMLScriptElement) pendingScript = node;
        else originalAppend.apply(document.head, [node]);
      }
    };
    const before = rendered;
    await act(async () => { mount(); });
    await act(async () => { root.render(null); });
    window.turnstile = api;
    await act(async () => { pendingScript!.dispatchEvent(new Event('load')); });
    check(rendered === before, 'Late script rendered after unmount');

    // Exercise the actual hook with an isolated store; never use configured credentials.
    let signups = 0;
    let subscriptions = 0;
    const auth = {
      getSession: async () => ({ data: { session: null }, error: null }),
      onAuthStateChange: () => {
        subscriptions++;
        return { data: { subscription: { unsubscribe: () => { subscriptions--; } } } };
      },
      signInAnonymously: async () => { signups++; throw new Error('Must not be called on mount'); },
    } as unknown as NonNullable<Parameters<typeof createAnonymousSessionStore>[0]>;
    const store = createAnonymousSessionStore(auth);
    function Consumer() { const state = useAnonymousSession(store); return <span>{state.status}</span>; }
    await act(async () => { root.render(<StrictMode><Consumer /><Consumer /></StrictMode>); });
    check(signups === 0 && subscriptions === 1 && host.textContent === 'idleidle', 'Hook created a session on navigation');
    await act(async () => { root.render(null); });
    check(Number(subscriptions) === 0, 'Hook leaked auth listener');
    return { passed: true, rendered, removed, scriptAttempts: scripts,
      cases: 'lazy loading, single script, script/widget errors, retry, expiry, single use, reset, late callbacks, StrictMode widget/hook cleanup, no signup on mount' };
  } finally {
    await act(async () => { root.unmount(); });
    host.remove();
    document.head.append = originalAppend;
    window.turnstile = previousApi;
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = previousAct;
  }
}
