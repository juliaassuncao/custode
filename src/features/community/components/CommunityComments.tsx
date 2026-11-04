import type { CommunityComment } from '../types';
import { commentAvatar } from '../services/commentAvatar';
import { CommunityIcon } from './CommunityIcon';
type Props = { comments: CommunityComment[]; reported: Set<string>; disabled: boolean; onReport(comment: CommunityComment): void };
const date = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short' });
export function CommunityComments({ comments, reported, disabled, onReport }: Props) {
  return <ol className="community-comments">
    {comments.map((comment) => { const avatar = commentAvatar(comment.pseudonym); return <li key={comment.id} className="community-comment">
      <article aria-label={`Comentário de ${comment.pseudonym}`}>
        <div className="community-comment__heading"><div className="community-comment__author">
          <span className={`community-avatar community-avatar--${avatar.tone}`} aria-hidden="true">{avatar.initials}</span>
          <h4>{comment.pseudonym}</h4><span className="community-anonymous">Anônimo</span></div>
          <time dateTime={comment.created_at}>{date.format(new Date(comment.created_at))}</time>
        </div>
        <p className="community-comment__body">{comment.body}</p>
        <div className="community-comment__footer"><button className="community-text-button" type="button"
          disabled={disabled || reported.has(comment.id)} onClick={() => onReport(comment)}
          aria-label={reported.has(comment.id) ? `Denúncia enviada para o comentário de ${comment.pseudonym}` : `Denunciar comentário de ${comment.pseudonym}`}>
          <CommunityIcon name="flag" />{reported.has(comment.id) ? 'Denúncia enviada' : 'Denunciar'}
        </button></div>
      </article>
    </li>; })}
  </ol>;
}
