import { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { publications } from '../data/publications';
import { VerticeArticle } from '../components/VerticeArticle';
import { VerticeMasthead } from '../components/VerticeMasthead';
import '../styles/vertice.scss';

export function PublicationPage() {
  const { slug } = useParams();
  const publication = publications.find((item) => item.slug === slug);

  useEffect(() => {
    document.title = publication ? `${publication.title} · ${publication.vehicle}` : 'Publicação não encontrada · A Imprensa';
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [publication]);

  return (
    <main className="vertice vertice--portal">
      <div className="vertice__page">
        <div className="vertice__utility"><Link to="/imprensa">← Todas as publicações</Link><span>CUSTODE / A IMPRENSA</span><Link to="/capitulo/28">Voltar ao capítulo 28</Link></div>
        <VerticeMasthead archiveNavigation />
        {publication ? <VerticeArticle publication={publication} /> : <h1>Publicação não encontrada</h1>}
        <footer className="vertice__article-footer"><Link to="/imprensa">← Todas as publicações</Link></footer>
      </div>
    </main>
  );
}
