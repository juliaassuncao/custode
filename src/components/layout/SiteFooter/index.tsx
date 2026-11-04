import { Link } from 'react-router-dom';
import { AuthorCredit } from '../AuthorCredit';
import { portalCreator } from '../../../data/projectCredits';
import styles from './styles.module.scss';

export function SiteFooter({ editorial = false }: { editorial?: boolean }) {
  return (
    <footer className={`${styles.footer}${editorial ? ` ${styles.editorial}` : ''}`}>
      <div className={styles.inner}>
        <p>Custode é uma obra de fanfiction publicada no AO3. Por ser uma fanfic, a história e a página imersiva não possuem fins lucrativos e todos os direitos referentes aos personagens originais pertencem aos seus respectivos criadores.</p>
        <p className={styles.development}>Concepção e desenvolvimento do portal: <AuthorCredit credit={portalCreator} />.</p>
        <Link className={styles.about} to="/o-projeto">O projeto e os créditos</Link>
      </div>
    </footer>
  );
}
