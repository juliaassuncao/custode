import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { invalidateCaptchaToken, registerCaptchaToken } from '../services/captchaTokens';
import { loadTurnstile, type TurnstileApi } from '../services/turnstileScript';

export type TurnstileChallengeHandle = { reset(): void };
type Props = { onToken(token: string | null): void; compact?: boolean };
type Status = 'loading' | 'ready' | 'verified' | 'expired' | 'consumed' | 'error';

// Mount only when participation is requested; importing this module loads no script.
export const TurnstileChallenge = forwardRef<TurnstileChallengeHandle, Props>(
  function TurnstileChallenge({ onToken, compact = false }, ref) {
    const container = useRef<HTMLDivElement>(null);
    const callback = useRef(onToken);
    callback.current = onToken;
    const [revision, setRevision] = useState(0);
    const [status, setStatus] = useState<Status>('loading');
    useImperativeHandle(ref, () => ({ reset: () => setRevision((value) => value + 1) }), []);

    useEffect(() => {
      let disposed = false;
      let api: TurnstileApi | undefined;
      let widget: string | undefined;
      let token: string | undefined;
      let tokenTimer: ReturnType<typeof setTimeout> | undefined;
      callback.current(null);
      setStatus('loading');
      function invalidate(next: Status) {
        clearTimeout(tokenTimer);
        if (token) invalidateCaptchaToken(token);
        token = undefined;
        if (!disposed) {
          callback.current(null);
          setStatus(next);
        }
      }
      const sitekey = import.meta.env.VITE_TURNSTILE_SITE_KEY?.trim();
      if (!sitekey || sitekey === 'YOUR_PUBLIC_TURNSTILE_SITE_KEY') {
        setStatus('error');
      } else {
        void loadTurnstile().then((loaded) => {
          if (disposed || !container.current) return;
          api = loaded;
          setStatus('ready');
          widget = loaded.render(container.current, {
            sitekey,
            size: compact ? 'compact' : 'normal',
            'response-field': false,
            callback: (value) => {
              if (disposed) return;
              invalidate('ready');
              if (!registerCaptchaToken(value, (reason) => {
                clearTimeout(tokenTimer);
                token = undefined;
                if (!disposed) {
                  callback.current(null);
                  setStatus(reason === 'consumed' ? 'consumed' : 'expired');
                }
              })) { setStatus('error'); return; }
              token = value;
              tokenTimer = setTimeout(() => invalidate('expired'), 300000);
              setStatus('verified');
              callback.current(value);
            },
            'expired-callback': () => { if (!disposed) invalidate('expired'); },
            'error-callback': () => { if (!disposed) invalidate('error'); },
            'timeout-callback': () => { if (!disposed) invalidate('expired'); },
          });
        }).catch(() => { if (!disposed) invalidate('error'); });
      }
      return () => {
        disposed = true;
        invalidate('ready');
        if (widget !== undefined) {
          try { api?.remove(widget); } catch { /* Widget may already have been removed. */ }
        }
        callback.current(null);
      };
    }, [revision, compact]);

    const text: Record<Status, string> = {
      loading: 'Carregando verificação de segurança…',
      ready: 'Conclua a verificação de segurança.',
      verified: 'Verificação concluída.',
      expired: 'A verificação expirou. Tente novamente.',
      consumed: 'Verificação utilizada.',
      error: 'A verificação está indisponível. Tente novamente.',
    };
    return <div>
      <div ref={container} />
      <p role="status" aria-live="polite">{text[status]}</p>
      {['error', 'expired', 'consumed'].includes(status) &&
        <button type="button" onClick={() => setRevision((value) => value + 1)}>Tentar novamente</button>}
    </div>;
  },
);
