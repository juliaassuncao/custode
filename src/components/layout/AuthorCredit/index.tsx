import { storyAuthor, type Credit } from '../../../data/projectCredits';
import styles from './styles.module.scss';

// Padrão de créditos da Alexandria: nome legível mesmo sem perfil disponível.
export function AuthorCredit({ credit = storyAuthor }: { credit?: Credit }) {
  let href: string | undefined;
  try {
    const url = new URL(credit.url ?? '');
    if (url.protocol === 'https:' || url.protocol === 'http:') href = url.href;
  } catch {
    // A ausência de um endereço válido mantém o crédito como texto.
  }

  return href ? (
    <a className={styles.credit} href={href} target="_blank" rel="noopener noreferrer" aria-label={`${credit.name} (abre em nova aba)`}>
      {credit.name}
    </a>
  ) : <span className={styles.credit}>{credit.name}</span>;
}
