import { useId } from 'react';
import type { Publication } from '../data/publications';
import { PublicationPhoto } from './PublicationPhoto';
import { PublicationSharing } from './PublicationSharing';

// Uma única apresentação do conteúdo, compartilhada entre leitor e portal.
export function VerticeArticle({ publication, embedded = false }: { publication: Publication; embedded?: boolean }) {
  const titleId = useId();
  const Heading = embedded ? 'h2' : 'h1';

  function renderParagraph(paragraph: string, index: number) {
    const quote = publication.pullQuote;
    const content = quote?.paragraphIndex === index ? <>
          {paragraph.slice(0, quote.start)}
          <span className="vertice__quote">
            <span className="vertice__quote-mark" aria-hidden="true">“</span>
            {paragraph.slice(quote.start, quote.end)}
          </span>
          {paragraph.slice(quote.end)}
        </> : paragraph;
    return <p key={index}>{publication.italic?.body ? <em>{content}</em> : content}</p>;
  }

  return (
    <article className="vertice__article" aria-labelledby={titleId}>
      <div className="vertice__lead">
        <header className="vertice__headline">
          <div className="vertice__dateline-row">
            <span className="vertice__exclusive">EXCLUSIVO</span>
            <p className="vertice__dateline">{publication.italic?.date ? <strong><em>{publication.date}</em></strong> : publication.date}</p>
          </div>
          <Heading id={titleId}>{publication.italic?.title ? <strong><em>{publication.title}</em></strong> : publication.title}</Heading>
        </header>
        <PublicationPhoto photo={publication.photo} />
        <PublicationSharing publication={publication} />
        <div className="vertice__opening">
          {publication.paragraphs.slice(0, 2).map(renderParagraph)}
          {publication.portrait && <div className="vertice__portrait"><PublicationPhoto photo={publication.portrait} /></div>}
        </div>
      </div>
      <div className="vertice__body">
        {publication.paragraphs.slice(2).map((paragraph, index) => renderParagraph(paragraph, index + 2))}
      </div>
    </article>
  );
}
