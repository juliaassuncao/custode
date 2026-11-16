import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ChapterNavigation } from '../components/reader/ChapterNavigation';
import { ReadingControls } from '../components/reader/ReadingControls';
import { ChapterDownloads } from '../components/reader/ChapterDownloads';
import { BackToTop } from '../components/reader/BackToTop';
import { useReadingPreferences } from '../hooks/useReadingPreferences';
import { useReadingProgress } from '../hooks/useReadingProgress';
import { chapter28Metadata, listedChapters } from '../data/chapter28/metadata';
import work from '../data/chapters/work.json';
import { loadReaderChapter, type ReaderChapter } from '../services/loadTranslation';
import { useReaderLanguage } from '../hooks/useReaderLanguage';
import { ReaderLocaleContext } from '../i18n/ReaderLocaleContext';
import { readerText } from '../i18n/messages';
import { ReaderLanguageSelector } from '../components/reader/ReaderLanguageSelector';
import { TranslationEditorialNotice } from '../components/reader/TranslationEditorialNotice';
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
  const { requestedLocale, selectLocale, previewDrafts, unsupportedLocale } = useReaderLanguage();
  const requestKey = `${chapterNumber}:${requestedLocale}:${previewDrafts}`;
  const [loaded, setLoaded] = useState<{ key: string; result: ReaderChapter | null } | null>(null);
  // Não renderizar dados antigos durante a mudança de capítulo ou idioma.
  const loading = validChapter && loaded?.key !== requestKey;
  const result = loaded?.key === requestKey ? loaded.result : null;
  const chapter = result?.chapter ?? null;
  const locale = result?.locale ?? requestedLocale;
  const t = (message: string, values?: Record<string, string | number>) => readerText(locale, message, values);
  const { prefs, update } = useReadingPreferences();
  const readerRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const { preserveForTop } = useReadingProgress({
    chapterNumber,
    locale,
    ready: !loading && chapter?.number === chapterNumber,
    contentRef,
    layoutKey: `${prefs.font}:${prefs.size}:${prefs.lineHeight}`,
  });
  const readingStyle = {
    '--reading-font': prefs.font === 'sans' ? 'Arial, Helvetica, sans-serif' : '"Times New Roman", Times, serif',
    '--reading-size': `${prefs.size}px`,
    '--reading-line-height': String(prefs.lineHeight),
  } as CSSProperties;

  useEffect(() => {
    if (!validChapter) return;
    let cancelled = false;
    loadReaderChapter(chapterNumber, requestedLocale, { previewDrafts })
      .then((data) => { if (!cancelled) setLoaded({ key: requestKey, result: data }); })
      .catch(() => { if (!cancelled) setLoaded({ key: requestKey, result: null }); });
    return () => { cancelled = true; };
  }, [chapterNumber, validChapter, requestedLocale, previewDrafts, requestKey]);

  useEffect(() => {
    document.title = `Custode · ${readerText(locale, validChapter ? 'Capítulo {number}' : 'Capítulo não encontrado', { number: chapterNumber })}`;
  }, [chapterNumber, validChapter, locale]);

  if (!validChapter) {
    return <main className="state-page"><h1>{t('Capítulo não encontrado')}</h1><Link to="/">{t('Voltar ao índice')}</Link></main>;
  }

  return (
    <ReaderLocaleContext.Provider value={locale}>
      <main ref={readerRef} className="reader" lang={locale}>
        <header className="reader__heading">
          <Link className="reader__back" to="/">← {t('Voltar ao índice')}</Link>
          <p className="reader__eyebrow">{`CUSTODE · ${chapterNumber} / ${listedChapters.length}`}</p>
          <h1 ref={titleRef} tabIndex={-1}>{t('Capítulo {number}', { number: chapterNumber })}</h1>
          <p className="reader__author">{t('por')} <AuthorCredit /></p>
        </header>
        <ReaderLanguageSelector value={locale} availableLocales={result?.availableLocales ?? ['pt-BR']} onChange={selectLocale} disabled={loading} />
        {previewDrafts && result && <p className="reader__preview" role="status">{t('Prévia local de traduções · Rascunhos não publicados.')}</p>}
        {!loading && result && (unsupportedLocale || result.locale !== requestedLocale) &&
          <p className="reader__status" role="status">{t('Esta versão ainda não está disponível. Você está lendo o original em português.')}</p>}
        <ChapterNavigation current={chapterNumber} requestedLocale={requestedLocale} previewDrafts={previewDrafts} />
        <ReadingControls
          value={prefs}
          onChange={update}
          actions={<ChapterDownloads key={`${chapterNumber}:${locale}:${previewDrafts}`} locale={locale} previewDrafts={previewDrafts} chapter={!loading && chapter?.number === chapterNumber ? chapter : null} />}
        />
        {loading ? <p className="reader__status" role="status">{t('Carregando capítulo...')}</p> : (
          chapter ? (
            <>
              {chapterNumber === 1 && (
                <AuthorNotes title={t('Nota da autora')} paragraphs={work.introNotes.split(/\n\s*\n/)} variant="intro" />
              )}
              <AuthorNotes title={t('Resumo do capítulo')} paragraphs={chapter.chapterSummary} />
              <AuthorNotes title={t('Notas da autora')} paragraphs={chapter.chapterNotes} />
              <TranslationEditorialNotice locale={locale} />
              <article ref={contentRef} className="chapter-content" style={readingStyle} aria-label={t('Texto do capítulo {number}', { number: chapterNumber })}>
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
              <AuthorNotes title={t('Notas finais da autora')} paragraphs={chapter.endNotes} />
            </>
          ) : <p className="reader__status" role="alert">{t('Não foi possível carregar este capítulo.')}</p>
        )}
        <ChapterNavigation current={chapterNumber} requestedLocale={requestedLocale} previewDrafts={previewDrafts} placement="bottom" />
        <div className="reader__end"><Link to="/">{t('Ver todos os capítulos')}</Link></div>
        {loaded?.result?.chapter.number === chapterNumber && <CommunityBoundary key={`community:${chapterNumber}`} locale={locale}>
          <Suspense fallback={<p className="reader__status" role="status">{t('Abrindo a comunidade…')}</p>}>
            <ChapterCommunity chapterNumber={chapterNumber} />
          </Suspense>
        </CommunityBoundary>}
        <BackToTop key={`back-to-top:${chapterNumber}`} readerRef={readerRef} topRef={titleRef} onBeforeScroll={preserveForTop} />
      </main>
    </ReaderLocaleContext.Provider>
  );
}
