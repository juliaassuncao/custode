import { useEffect, useId, useRef, useState } from 'react';
import { useAnonymousSession } from '../hooks/useAnonymousSession';
import { communityWrite, type Mutation } from '../services/communityWrite';
import { CommunityRequestError } from '../services/communityErrors';
import type { WriteResults } from '../types';
import { TurnstileChallenge } from './TurnstileChallenge';
import { CommunityIcon } from './CommunityIcon';

type Props = { command: Mutation; onSuccess(result: WriteResults[Mutation['operation']]): void;
  onCancel(): void; onAttempt?(): void; onRejected?(): void; onUncertain?(): void };
type Phase = 'checking' | 'session' | 'session-busy' | 'write' | 'write-busy' | 'error';
export function CommunityAction({ command, onSuccess, onCancel, onAttempt, onRejected, onUncertain }: Props) {
  const { ensureSession, getSnapshot } = useAnonymousSession();
  const [phase, setPhase] = useState<Phase>('checking');
  const current = useRef<Phase>('checking');
  const [failure, setFailure] = useState('');
  const [retryAt, setRetryAt] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const inFlight = useRef(false);
  const mounted = useRef(true);
  const heading = useRef<HTMLHeadingElement>(null);
  const titleId = useId();
  function move(next: Phase) { current.current = next; setPhase(next); }
  async function checkSession() {
    if (inFlight.current) return;
    inFlight.current = true; move('checking'); setFailure('');
    try {
      await ensureSession(); // Recovery only: no proof means no new identity.
      if (mounted.current) move('write');
    } catch (cause) {
      if (!mounted.current) return;
      const state = getSnapshot();
      if (state.error?.code === 'captcha_required') move('session');
      else { setFailure(cause instanceof Error ? cause.message : 'Não foi possível continuar.'); move('error'); }
    } finally { inFlight.current = false; }
  }
  useEffect(() => {
    mounted.current = true; heading.current?.focus(); void checkSession();
    return () => { mounted.current = false; };
  }, []);
  useEffect(() => {
    if (!retryAt) return;
    const tick = () => setRemaining(Math.max(0, Math.ceil((retryAt - Date.now()) / 1000)));
    tick(); const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [retryAt]);
  async function continueWithProof(token: string) {
    const stage = current.current;
    if (!mounted.current || inFlight.current || remaining > 0 || (stage !== 'session' && stage !== 'write')) return;
    inFlight.current = true; move(stage === 'session' ? 'session-busy' : 'write-busy');
    try {
      if (stage === 'session') {
        await ensureSession(token);
        if (mounted.current) move('write'); // Fresh proof; never reuse Auth's consumed token.
      } else {
        onAttempt?.();
        const result = await communityWrite(command, token);
        if (mounted.current) onSuccess(result);
      }
    } catch (cause) {
      if (!mounted.current) return;
      setFailure(cause instanceof Error ? cause.message : 'Não foi possível confirmar o envio.'); move('error');
      if (cause instanceof CommunityRequestError) {
        if (cause.uncertain) onUncertain?.();
        if (!cause.uncertain && cause.code !== 'idempotency_conflict') onRejected?.();
        if (cause.retryAfter) { setRetryAt(Date.now() + cause.retryAfter * 1000); setRemaining(cause.retryAfter); }
      }
    } finally { inFlight.current = false; }
  }
  const busy = phase === 'checking' || phase === 'session-busy' || phase === 'write-busy';
  const widgetStage = phase === 'session' || phase === 'session-busy' ? 'session' : 'write';
  return <section className="community-action" aria-labelledby={titleId}
    onKeyDown={(event) => { if (event.key === 'Escape' && !busy) { event.stopPropagation(); onCancel(); } }}>
    <div className="community-action__heading"><h3 id={titleId} ref={heading} tabIndex={-1}><CommunityIcon name="shield" /> Verificação de segurança</h3>
      <button className="community-text-button" type="button" disabled={busy} onClick={onCancel}>Cancelar</button></div>
    <p className="community-help" role="status">{busy ? 'Confirmando…' : phase === 'error' ? 'O envio não foi concluído.' : 'Conclua a verificação. O envio continuará automaticamente.'}</p>
    {phase !== 'checking' && phase !== 'error' && <div hidden={busy}>
      {/* Keep mounted while consuming: unmounting invalidates the proof. */}
      <TurnstileChallenge key={widgetStage} compact onToken={(token) => { if (token) void continueWithProof(token); }} />
    </div>}
    {failure && <p className="community-message community-message--error" role="alert">{failure}</p>}
    {remaining > 0 && <p role="status">Tente novamente em {remaining}s.</p>}
    {phase === 'error' && <button className="community-button community-button--secondary" type="button" disabled={remaining > 0} onClick={() => void checkSession()}>Tentar novamente</button>}
  </section>;
}
