import { useEffect, useId, useRef, useState } from 'react';
import type { CommunityComment } from '../types';
import type { Mutation } from '../services/communityWrite';
import { CommunityIcon } from './CommunityIcon';
const reasons = { spam: 'Spam', harassment: 'Assédio', hate_or_discrimination: 'Ódio ou discriminação',
  spoiler: 'Spoiler', inappropriate_content: 'Conteúdo impróprio', other: 'Outro' };
type Props = { comment: CommunityComment; locked: boolean; onCancel(): void; onSubmit(command: Mutation): void };
export function CommentReportForm({ comment, locked, onCancel, onSubmit }: Props) {
  const [reason, setReason] = useState('spam');
  const [details, setDetails] = useState('');
  const [error, setError] = useState('');
  const id = useId();
  const select = useRef<HTMLSelectElement>(null);
  useEffect(() => { select.current?.focus(); }, []);
  return <form className="community-report" onSubmit={(event) => {
    event.preventDefault();
    if ([...details.trim()].length > 2000) { setError('Use até 2.000 caracteres nos detalhes.'); return; }
    onSubmit({ operation: 'report', comment_id: comment.id, reason_code: reason, details: details.trim() });
  }}>
    <div className="community-action__heading"><h3><CommunityIcon name="flag" />Denunciar comentário de {comment.pseudonym}</h3>
      <button className="community-text-button" type="button" disabled={locked} onClick={onCancel}>Cancelar denúncia</button></div>
    <p className="community-help">Denúncia anônima, encaminhada à moderação.</p>
    <fieldset disabled={locked}><legend className="community-visually-hidden">Motivo da denúncia</legend>
      <div className="community-field"><label htmlFor={`${id}-reason`}>Motivo</label>
        <select ref={select} id={`${id}-reason`} value={reason} onChange={(e) => setReason(e.target.value)}>
          {Object.entries(reasons).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select></div>
      <div className="community-field"><label htmlFor={`${id}-details`}>Detalhes <span>(opcional)</span></label>
        <textarea id={`${id}-details`} value={details} rows={3} onChange={(e) => setDetails(e.target.value)} aria-describedby={`${id}-help`} />
        <span id={`${id}-help`} className="community-help">Até 2.000 caracteres.</span></div>
      {error && <p className="community-message community-message--error" role="alert">{error}</p>}
      <button type="submit" className="community-button community-button--secondary">Enviar denúncia</button>
    </fieldset>
  </form>;
}
