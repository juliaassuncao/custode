import { Link } from 'react-router-dom';
import { AuthorCredit } from '../AuthorCredit';
import { portalCreator } from '../../../data/projectCredits';
import styles from './styles.module.scss';

export function SiteFooter({ editorial = false }: { editorial?: boolean }) {
  return (
    <footer className={`${styles.footer}${editorial ? ` ${styles.editorial}` : ''}`}>
      <div className={styles.inner}>
        <p>Custode é uma obra de ficção escrita por <AuthorCredit />. Os direitos sobre o texto e suas contribuições criativas são reconhecidos à autora.</p>
        <p>Este portal é uma experiência digital independente e complementar à obra, sem caráter de publicação oficial.</p>
        <p className={styles.development}>Concepção e desenvolvimento do portal: <AuthorCredit credit={portalCreator} />.</p>
        <Link className={styles.about} to="/o-projeto">O projeto e os créditos</Link>
      </div>
    </footer>
  );
}
