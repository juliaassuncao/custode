import { lazy, Suspense, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ChapterNavigation } from '../components/reader/ChapterNavigation';
import { chapter28Metadata, listedChapters } from '../data/chapter28/metadata';
import work from '../data/chapters/work.json';
import { loadChapter } from '../services/loadChapter';
import type { Chapter } from '../types';
import { resolveVerticeArticle } from '../features/imprensa/resolveVerticeArticle';
import { VerticeArticleEmbed } from '../features/imprensa/components/VerticeArticleEmbed';
import { AuthorCredit } from '../components/layout/AuthorCredit';
import { Chapter28Tweets } from '../features/chapter28/components/Chapter28Tweets';
import { InternationalHeadlines } from '../features/chapter28/components/InternationalHeadlines';
import { SceneSeparator, isSceneSeparator } from '../components/reader/SceneSeparator';
import { CommunityBoundary } from '../features/community/components/CommunityBoundary';

const ChapterCommunity = lazy(() => import('../features/community/ChapterCommunity').then((module) => ({ default: module.ChapterCommunity })));

function AuthorNotes({ title, paragraphs, variant }: { title: string; paragraphs?: string[]; variant?: 'intro' }) {
  if (!paragraphs?.length) return null;
  return (
    <aside className={`author-notes${variant === 'intro' ? ' author-notes--intro' : ''}`} aria-label={title}>
      <h2>{title}</h2>
      {paragraphs.map((text, idx) => (
        // HTML é gerado exclusivamente pelo extrator local: só <em>, <strong> e texto escapado.
        <p key={idx} dangerouslySetInnerHTML={{ __html: text }} />
      ))}
    </aside>
  );
}

export function ChapterPage() {
  const { number: numberParam } = useParams();
  const chapterNumber = Number(numberParam);
  const validChapter = Number.isInteger(chapterNumber) && (listedChapters.some((item) => item.number === chapterNumber) || chapterNumber === chapter28Metadata.number);
  const [chapter, setChapter] = useState<Chapter | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
    if (!validChapter) {
      setChapter(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setChapter(null);
    setLoading(true);
    loadChapter(chapterNumber)
      .then((data) => { if (!cancelled) setChapter(data); })
      .catch(() => { if (!cancelled) setChapter(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [chapterNumber, validChapter]);

  useEffect(() => {
    document.title = validChapter ? `Custode · Capítulo ${chapterNumber}` : 'Custode · Capítulo não encontrado';
  }, [chapterNumber, validChapter]);

  if (!validChapter) {
    return <main className="state-page"><h1>Capítulo não encontrado</h1><Link to="/">Voltar ao índice</Link></main>;
  }

  return (
    <main className="reader">
      <header className="reader__heading">
        <Link className="reader__back" to="/">← Voltar ao índice</Link>
        <p className="reader__eyebrow">{`CUSTODE · ${chapterNumber} / ${listedChapters.length}`}</p>
        <h1>Capítulo {chapterNumber}</h1>
        <p className="reader__author">por <AuthorCredit /></p>
      </header>
      <ChapterNavigation current={chapterNumber} />
      {loading ? <p className="reader__status" role="status">Carregando capítulo...</p> : (
        chapter ? (
          <>
            {chapterNumber === 1 && (
              <AuthorNotes title="Nota da autora" paragraphs={work.introNotes.split(/\n\s*\n/)} variant="intro" />
            )}
            <AuthorNotes title="Resumo do capítulo" paragraphs={chapter.chapterSummary} />
            <AuthorNotes title="Notas da autora" paragraphs={chapter.chapterNotes} />
            <article className="chapter-content" aria-label={`Texto do capítulo ${chapterNumber}`}>
              {chapter.blocks.map((block, index) => {
                const publication = resolveVerticeArticle(chapter.number, block);
                if (publication) return <VerticeArticleEmbed key={index} publication={publication} />;
                if (block.type === 'verticeArticle') return null;
                if (block.type === 'socialPosts' && chapter.number === chapter28Metadata.number) return <Chapter28Tweets key={index} />;
                if (block.type === 'internationalHeadlines' && chapter.number === chapter28Metadata.number) return <InternationalHeadlines key={index} />;
                if (isSceneSeparator(block)) return <SceneSeparator key={index} />;
                return block.type === 'separator'
                  ? <div className="chapter-content__separator" key={index} aria-hidden="true" dangerouslySetInnerHTML={{ __html: block.html ?? '✦' }} />
                  : <p key={index} dangerouslySetInnerHTML={{ __html: block.html ?? '' }} />;
              })}
            </article>
            <AuthorNotes title="Notas finais da autora" paragraphs={chapter.endNotes} />
          </>
        ) : <p className="reader__status" role="alert">Não foi possível carregar este capítulo.</p>
      )}
      <ChapterNavigation current={chapterNumber} placement="bottom" />
      <div className="reader__end"><Link to="/">Ver todos os capítulos</Link></div>
      {!loading && chapter?.number === chapterNumber && <CommunityBoundary key={chapterNumber}>
        <Suspense fallback={<p className="reader__status" role="status">Abrindo a comunidade…</p>}>
          <ChapterCommunity chapterNumber={chapterNumber} />
        </Suspense>
      </CommunityBoundary>}
    </main>
  );
}
