import { useId } from 'react';
import { CommunityIcon } from './CommunityIcon';
type Props = { pseudonym: string; body: string; locked: boolean; pending: boolean; disabled: boolean;
  error: string; onPseudonym(value: string): void; onBody(value: string): void; onPublish(): void };
export function CommentComposer(props: Props) {
  const id = useId();
  const nameLength = [...props.pseudonym.trim()].length;
  const bodyLength = [...props.body.trim()].length;
  const invalidName = !!props.error && (nameLength < 2 || nameLength > 40 || props.pseudonym.includes('\0'));
  const invalidBody = !!props.error && (bodyLength < 1 || bodyLength > 5000 || props.body.includes('\0'));
  return <form className="community-composer" noValidate onSubmit={(event) => { event.preventDefault(); props.onPublish(); }}>
    <p className="community-privacy"><CommunityIcon name="shield" />Participação anônima</p>
    <div className="community-field"><label className="community-visually-hidden" htmlFor={`${id}-name`}>Pseudônimo</label>
      <div className="community-input-icon"><CommunityIcon name="person" />
      <input id={`${id}-name`} name="pseudonym" autoComplete="nickname" value={props.pseudonym}
        placeholder="Pseudônimo" readOnly={props.locked} onChange={(e) => props.onPseudonym(e.target.value)}
        aria-invalid={invalidName} aria-describedby={`${id}-name-help${invalidName ? ` ${id}-error` : ''}`} required />
      </div><span className="community-visually-hidden" id={`${id}-name-help`}>De 2 a 40 caracteres.</span>
    </div>
    <div className="community-field"><label className="community-visually-hidden" htmlFor={`${id}-body`}>Seu comentário</label>
      <textarea id={`${id}-body`} name="comment" rows={5} value={props.body} required readOnly={props.locked}
        placeholder="Escreva seu comentário..." onChange={(e) => props.onBody(e.target.value)}
        aria-invalid={invalidBody} aria-describedby={`${id}-body-help${invalidBody ? ` ${id}-error` : ''}`} />
      <span className="community-help community-composer__help" id={`${id}-body-help`}>
        <span>{[...props.body.trim()].length.toLocaleString('pt-BR')} / 5.000</span>
      </span>
    </div>
    {props.error && <p id={`${id}-error`} className="community-message community-message--error" role="alert">{props.error}</p>}
    {props.pending && <p className="community-help">Envio não confirmado. Reenvie para conferir.</p>}
    <div className="community-composer__footer"><p className="community-help">Com gentileza, para a autora e para quem lê.</p>
      <button type="submit" className="community-button" disabled={props.disabled} aria-label={props.pending ? 'Reenviar comentário' : 'Publicar comentário'}>{props.pending ? 'Reenviar' : 'Publicar'}</button>
    </div>
  </form>;
}
