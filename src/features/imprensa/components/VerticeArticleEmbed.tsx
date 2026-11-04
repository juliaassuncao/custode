import { Link } from 'react-router-dom';
import { publicationPath, type Publication } from '../data/publications';
import { VerticeArticle } from './VerticeArticle';
import { VerticeMasthead } from './VerticeMasthead';
import styles from './VerticeArticleEmbed.module.scss';
import '../styles/vertice.scss';

export function VerticeArticleEmbed({ publication }: { publication: Publication }) {
  return (
    <section className={`vertice ${styles.embed}`} aria-label="Reportagem do Vértice incorporada ao capítulo">
      <VerticeMasthead />
      <VerticeArticle publication={publication} embedded />
      <footer className="vertice__article-footer">
        <Link to={publicationPath(publication)}>Ler no portal Vértice ↗</Link>
      </footer>
    </section>
  );
}
