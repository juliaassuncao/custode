import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { publications, publicationPath, type Publication } from '../data/publications';
import { VerticeMasthead } from '../components/VerticeMasthead';
import { PublicationPhoto } from '../components/PublicationPhoto';
import '../styles/vertice.scss';

export function ImprensaPage() {
  const { hash } = useLocation();
  const featured = publications.filter((publication) => publication.listed !== false && publication.featured);
  const archive = publications.filter((publication) => publication.listed !== false && !publication.featured);

  useEffect(() => {
    document.title = 'Publicações · Vértice · A Imprensa · Custode';
    const section = hash === '#destaques' || hash === '#publicacoes'
      ? document.getElementById(hash.slice(1)) : null;
    if (section) section.scrollIntoView({ behavior: 'auto' });
    else window.scrollTo({ top: 0, behavior: 'auto' });
  }, [hash]);

  return (
    <main className="vertice vertice--portal">
      <div className="vertice__page">
        <div className="vertice__utility"><Link to="/">← Índice de capítulos</Link><span>CUSTODE / A IMPRENSA</span></div>
        <VerticeMasthead archiveNavigation />
        <header className="vertice__index-heading" id="publicacoes">
          <p>ARQUIVO JORNALÍSTICO DO UNIVERSO CUSTODE</p>
          <h1>PUBLICAÇÕES</h1>
          <p className="vertice__archive-description">Reportagens, notícias e registros jornalísticos dos acontecimentos que atravessam o universo Custode.</p>
        </header>
        {featured.length > 0 && <section id="destaques" aria-labelledby="destaques-title">
          <h2 className="vertice__section-title" id="destaques-title">Em destaque</h2>
          <div className="vertice__publications">
            {featured.map((publication) => <PublicationEntry key={publication.id} publication={publication} />)}
          </div>
        </section>}
        {archive.length > 0 && (
          <section aria-labelledby="arquivo-title">
            <h2 className="vertice__section-title" id="arquivo-title">Arquivo</h2>
            <div className="vertice__publications">
              {archive.map((publication) => <PublicationEntry key={publication.id} publication={publication} />)}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

function PublicationEntry({ publication }: { publication: Publication }) {
  return (
    <article className="vertice__publication">
      <PublicationPhoto photo={publication.photo} />
      <div>
        <p className="vertice__vehicle">{publication.vehicle}{publication.category && ` · ${publication.category}`}</p>
        <h2><Link to={publicationPath(publication)}>{publication.title}</Link></h2>
        <p className="vertice__dateline">{publication.date}</p>
        <Link className="vertice__read-link" to={publicationPath(publication)}>Ler reportagem ↗</Link>
      </div>
    </article>
  );
}
