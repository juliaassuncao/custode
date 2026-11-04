import headlines from '../../../../data/chapter28/headlines.json';
import styles from './styles.module.scss';

export function InternationalHeadlines() {
  return (
    <section className={styles.clippings} aria-label="Manchetes internacionais">
      {headlines.map((headline) => (
        <article className={styles.clipping} key={headline.language} lang={headline.language}>
          <h2 dangerouslySetInnerHTML={{ __html: headline.html }} />
        </article>
      ))}
    </section>
  );
}
