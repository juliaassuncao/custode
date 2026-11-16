import { useReaderText } from '../../../i18n/ReaderLocaleContext';
import type { CommunityComment } from '../types';
import { commentAvatar } from '../services/commentAvatar';
import { CommunityIcon } from './CommunityIcon';
type Props = { comments: CommunityComment[]; reported: Set<string>; disabled: boolean; onReport(comment: CommunityComment): void };
export function CommunityComments({ comments, reported, disabled, onReport }: Props) {
  const { locale, t } = useReaderText();
  const date = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' });
  return <ol className="community-comments">
    {comments.map((comment) => { const avatar = commentAvatar(comment.pseudonym); return <li key={comment.id} className="community-comment">
      <article aria-label={t('Comentário de {name}', { name: comment.pseudonym })}>
        <div className="community-comment__heading"><div className="community-comment__author">
          <span className={`community-avatar community-avatar--${avatar.tone}`} aria-hidden="true">{avatar.initials}</span>
          <h4 translate="no">{comment.pseudonym}</h4><span className="community-anonymous">{t('Anônimo')}</span></div>
          <time dateTime={comment.created_at}>{date.format(new Date(comment.created_at))}</time>
        </div>
        <p className="community-comment__body" translate="no">{comment.body}</p>
        <div className="community-comment__footer"><button className="community-text-button" type="button"
          disabled={disabled || reported.has(comment.id)} onClick={() => onReport(comment)}
          aria-label={reported.has(comment.id) ? t('Denúncia enviada para o comentário de {name}', { name: comment.pseudonym }) : t('Denunciar comentário de {name}', { name: comment.pseudonym })}>
          <CommunityIcon name="flag" />{reported.has(comment.id) ? t('Denúncia enviada') : t('Denunciar')}
        </button></div>
      </article>
    </li>; })}
  </ol>;
}
