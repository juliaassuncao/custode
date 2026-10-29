import { Link } from 'react-router-dom';
import manifest from '../data/chapters/manifest.json';
import work from '../data/chapters/work.json';

export function HomePage() {
  return (
    <main className="home">
      <section className="home__hero">
        <img className="home__logo" src="/custode-logo.jpg" alt="Custode — trevo de quatro folhas verde-sálvia" />
        <p className="home__eyebrow">Fanfic Loquinha · Lorena &amp; Eduarda</p>
        <h1>{work.title}</h1>
        <p className="home__byline">por {work.author}</p>
        <p className="home__intro">{work.summary}</p>
        <p className="home__notice">Obra para público adulto · Conteúdo sensível, incluindo doença e violência. Leia os avisos originais da autora.</p>
        <Link className="primary-link" to="/capitulo/1">Começar a leitura <span aria-hidden="true">→</span></Link>
      </section>
      <section className="index" aria-labelledby="index-title">
        <div className="index__heading">
          <h2 id="index-title">Índice de capítulos</h2>
          <span>{manifest.length} capítulos</span>
        </div>
        <div className="index__grid">
          {manifest.map((chapter) => (
            <Link className="index__chapter" key={chapter.number} to={`/capitulo/${chapter.number}`}>
              <span>{chapter.title}</span>
              <span aria-hidden="true">→</span>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
