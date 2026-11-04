import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { AdminAccessError } from './adminAuth';
import { adminMutate, AdminMutationError, createAdminMutation, type AdminMutation, type AdminOperation } from './adminMutate';

const labels: Record<AdminOperation, { action: string; confirm: string; success: string; explanation: string }> = {
  hide_comment: { action: 'Ocultar', confirm: 'Confirmar ocultação', success: 'Comentário ocultado.', explanation: 'O comentário deixará de aparecer na comunidade pública.' },
  restore_comment: { action: 'Restaurar', confirm: 'Confirmar restauração', success: 'Comentário restaurado.', explanation: 'O comentário voltará a aparecer na comunidade pública.' },
  resolve_report: { action: 'Resolver', confirm: 'Confirmar resolução', success: 'Denúncia resolvida.', explanation: 'A denúncia será encerrada como resolvida. O comentário não será alterado.' },
  dismiss_report: { action: 'Descartar', confirm: 'Confirmar descarte', success: 'Denúncia descartada.', explanation: 'A denúncia será encerrada como descartada. O comentário não será alterado.' },
};
type Props = {
  target: string; version: number; kind: 'comment' | 'report'; status: string;
  pending?: AdminMutation; onPending(command: AdminMutation | null): void;
  onSuccess(message: string): void; onRefresh(): void; onAccessDenied(message: string): void;
};

export function AdminModerationActions({ target, version, kind, status, pending, onPending, onSuccess, onRefresh, onAccessDenied }: Props) {
  const [operation, setOperation] = useState<AdminOperation | null>(pending?.operation ?? null);
  const [note, setNote] = useState(pending?.note ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [blocked, setBlocked] = useState(false);
  const [success, setSuccess] = useState('');
  const sending = useRef(false);
  const sentVersion = useRef(version);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const container = useRef<HTMLDivElement>(null);
  const id = useId();
  useEffect(() => { if (operation) textarea.current?.focus(); }, [operation]);

  const available: AdminOperation[] = version > 2147483646 ? [] : kind === 'comment' ?
    status === 'published' ? ['hide_comment'] : status === 'hidden' ? ['restore_comment'] : [] :
    status === 'open' ? ['resolve_report', 'dismiss_report'] : [];

  function cancel() {
    if (sending.current || pending) return;
    setOperation(null); setError(''); setBlocked(false); setNote('');
    requestAnimationFrame(() => container.current?.querySelector('button')?.focus());
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!operation || sending.current || blocked || success) return;
    let command: AdminMutation;
    try { command = pending ?? createAdminMutation(operation, target, version, note); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Confira os dados.'); return; }
    sentVersion.current = command.expected_version;
    sending.current = true; setBusy(true); setError(''); onPending(command);
    try {
      await adminMutate(command);
      const message = labels[command.operation].success;
      setSuccess(message); setOperation(null); setNote(''); onPending(null); onSuccess(message);
    } catch (cause) {
      if (cause instanceof AdminAccessError && cause.reason !== 'unavailable') { onAccessDenied(cause.message); return; }
      if (cause instanceof AdminMutationError && !cause.uncertain) {
        onPending(null);
        setBlocked(cause.code !== 'invalid_parameters');
      }
      setError(cause instanceof Error ? cause.message : 'Não foi possível confirmar o resultado. Repita o envio.');
    } finally { sending.current = false; setBusy(false); }
  }

  if (!available.length && !pending && !success) return null;
  return <div className="admin-dashboard__moderation" ref={container}>
    {success && <p role="status">{success}</p>}
    {success && version <= sentVersion.current ? null : !operation ? <div className="admin-dashboard__action-buttons">
      {available.map(value => <button className="nav-button" key={value} type="button" onClick={() => { setSuccess(''); setOperation(value); }}>{labels[value].action}</button>)}
    </div> : <form aria-labelledby={`${id}-title`} onSubmit={event => void submit(event)} onKeyDown={event => { if (event.key === 'Escape' && !pending && !busy) { event.preventDefault(); cancel(); } }}>
      <h4 id={`${id}-title`}>{labels[operation].confirm}</h4>
      <p id={`${id}-help`}>{labels[operation].explanation}</p>
      <label htmlFor={`${id}-note`}>{operation === 'hide_comment' ? 'Motivo obrigatório' : 'Observação opcional'}</label>
      <textarea id={`${id}-note`} ref={textarea} rows={3} value={pending?.note ?? note} readOnly={!!pending} disabled={busy || blocked}
        required={operation === 'hide_comment'} aria-describedby={`${id}-help ${id}-limit`} onChange={event => setNote(event.target.value)} />
      <p id={`${id}-limit`} className="admin-dashboard__meta">Até 2.000 caracteres.</p>
      {error && <p role="alert">{error}</p>}
      {pending && !busy && !error && <p role="status">Este envio aguarda confirmação de resultado. Repita com os mesmos dados.</p>}
      <div className="admin-dashboard__action-buttons">
        {blocked ? <button type="button" className="nav-button" onClick={onRefresh}>Atualizar listagem</button> :
          <button type="submit" className="primary-link" disabled={busy}>{busy ? 'Enviando…' : pending ? 'Repetir envio' : labels[operation].confirm}</button>}
        {!pending && <button type="button" className="nav-button" disabled={busy} onClick={cancel}>Cancelar</button>}
      </div>
      {busy && <p role="status">Executando ação…</p>}
    </form>}
  </div>;
}
