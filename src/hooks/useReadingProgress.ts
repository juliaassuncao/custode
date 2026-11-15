import { useCallback, useLayoutEffect, useRef } from 'react';
import type { RefObject } from 'react';

interface ReadingPosition {
  chapter: number;
  paragraph: number | null;
  offset: number;
  ratio: number | null;
  scrollY: number;
}

interface ProgressController {
  preserveForTop: () => void;
  realign: () => void;
}

const readingInset = 24;
const storageKey = (chapter: number) => `custode:reading-progress:v1:${chapter}`;

function readPosition(chapter: number): ReadingPosition | null {
  try {
    const value = JSON.parse(window.localStorage.getItem(storageKey(chapter)) ?? 'null') as Partial<ReadingPosition> | null;
    if (!value || value.chapter !== chapter
      || !(value.paragraph === null || (Number.isInteger(value.paragraph) && Number(value.paragraph) >= 0))
      || typeof value.offset !== 'number' || !Number.isFinite(value.offset)
      || typeof value.scrollY !== 'number' || !Number.isFinite(value.scrollY) || value.scrollY < 0) return null;
    return {
      chapter,
      paragraph: value.paragraph ?? null,
      offset: value.offset,
      ratio: typeof value.ratio === 'number' && Number.isFinite(value.ratio) && value.ratio >= 0 && value.ratio <= 1 ? value.ratio : null,
      scrollY: value.scrollY,
    };
  } catch {
    return null;
  }
}

// A busca fica restrita ao artigo narrativo, incluindo os parágrafos dos blocos especiais.
function paragraphs(article: HTMLElement): HTMLElement[] {
  return Array.from(article.querySelectorAll<HTMLElement>('p:not([role="status"]):not([role="alert"])'));
}

function measurePosition(article: HTMLElement, chapter: number): ReadingPosition | null {
  const bounds = article.getBoundingClientRect();
  if (bounds.top > readingInset || bounds.bottom <= readingInset) return null;
  const items = paragraphs(article);
  let index = items.findIndex((paragraph) => {
    const rect = paragraph.getBoundingClientRect();
    return rect.height > 0 && rect.bottom > readingInset;
  });
  if (index < 0) index = items.length - 1;
  const rect = items[index]?.getBoundingClientRect();
  const offset = rect ? Math.min(readingInset - rect.top, rect.height) : 0;
  return {
    chapter,
    paragraph: rect ? index : null,
    offset,
    // A fração do parágrafo acompanha mudanças de fonte, entrelinha e largura.
    ratio: rect && rect.height > 0 && offset >= 0 ? offset / rect.height : null,
    scrollY: window.scrollY,
  };
}

function targetScroll(article: HTMLElement, position: ReadingPosition): number {
  const paragraph = position.paragraph === null ? undefined : paragraphs(article)[position.paragraph];
  const rect = paragraph?.getBoundingClientRect();
  const offset = rect && position.ratio !== null ? rect.height * position.ratio : position.offset;
  const target = rect ? window.scrollY + rect.top + offset - readingInset : position.scrollY;
  const narrativeEnd = window.scrollY + article.getBoundingClientRect().bottom - readingInset;
  const pageEnd = document.documentElement.scrollHeight - window.innerHeight;
  return Math.max(0, Math.min(target, narrativeEnd, pageEnd));
}

export function useReadingProgress({ chapterNumber, ready, contentRef, layoutKey }: {
  chapterNumber: number;
  ready: boolean;
  contentRef: RefObject<HTMLElement>;
  layoutKey: string;
}) {
  const controller = useRef<ProgressController | null>(null);

  useLayoutEffect(() => {
    const previous = window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';
    return () => { window.history.scrollRestoration = previous; };
  }, []);

  useLayoutEffect(() => {
    // Esta é a única rolagem inicial do leitor. Não há gravação durante o carregamento.
    window.scrollTo({ top: 0, behavior: 'auto' });
    const content = contentRef.current;
    if (!ready || !content) return;
    const article: HTMLElement = content;

    let disposed = false;
    let phase: 'restoring' | 'active' = 'restoring';
    let progress = readPosition(chapterNumber);
    let anchor = progress;
    let restoreGoal = progress;
    let dirty = false;
    let preservingTop = false;
    let reachedTop = false;
    let generation = 0;
    let restoreFrame = 0;
    let scrollFrame = 0;
    let saveTimer = 0;
    let lastScrollY = window.scrollY;
    let viewportWidth = window.innerWidth;

    function persist() {
      window.clearTimeout(saveTimer);
      if (!dirty || !progress) return;
      try {
        window.localStorage.setItem(storageKey(chapterNumber), JSON.stringify(progress));
        dirty = false;
      } catch {
        // Armazenamento opcional: a posição continua disponível nesta montagem do leitor.
      }
    }

    function capture() {
      anchor = measurePosition(article, chapterNumber);
      if (anchor) {
        progress = anchor;
        dirty = true;
        window.clearTimeout(saveTimer);
        saveTimer = window.setTimeout(persist, 500);
      }
    }

    function cancelRestore() {
      generation += 1;
      window.cancelAnimationFrame(restoreFrame);
    }

    function restore(goal: ReadingPosition | null) {
      cancelRestore();
      const operation = generation;
      phase = 'restoring';
      restoreGoal = goal;
      window.cancelAnimationFrame(scrollFrame);
      const fontsReady = document.fonts ? document.fonts.ready.catch(() => undefined) : Promise.resolve();
      void fontsReady.then(() => {
        if (disposed || operation !== generation) return;
        let frames = 0;
        const settle = () => {
          if (disposed || operation !== generation) return;
          window.scrollTo({ top: goal ? targetScroll(article, goal) : 0, behavior: 'auto' });
          frames += 1;
          if (frames < 3) {
            restoreFrame = window.requestAnimationFrame(settle);
          } else {
            lastScrollY = window.scrollY;
            // Manter a referência desejada se o navegador ainda limitou a rolagem
            // por imagens ou conteúdo abaixo da história que estejam carregando.
            anchor = goal ?? measurePosition(article, chapterNumber);
            phase = 'active';
          }
        };
        restoreFrame = window.requestAnimationFrame(settle);
      });
    }

    function realign(force = false) {
      if (disposed || preservingTop) return;
      const goal = phase === 'restoring' ? restoreGoal : anchor;
      if (goal && (force || Math.abs(targetScroll(article, goal) - window.scrollY) > 1)) restore(goal);
    }

    function onScroll() {
      window.cancelAnimationFrame(scrollFrame);
      scrollFrame = window.requestAnimationFrame(() => {
        if (disposed || phase !== 'active') return;
        const currentY = window.scrollY;
        if (preservingTop) {
          if (currentY <= 1) reachedTop = true;
          else if (reachedTop) preservingTop = false;
          if (preservingTop) { lastScrollY = currentY; return; }
        }
        // Eventos atrasados da nossa própria restauração não geram novas gravações.
        if (Math.abs(currentY - lastScrollY) > 0.5) capture();
        lastScrollY = currentY;
      });
    }

    function resumeUserScroll() {
      if (preservingTop) window.scrollTo({ top: window.scrollY, behavior: 'auto' });
      preservingTop = false;
      if (phase === 'restoring') {
        cancelRestore();
        phase = 'active';
        lastScrollY = window.scrollY;
      }
      anchor = measurePosition(article, chapterNumber);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || !['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(event.key)) return;
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest('input, textarea, select, [contenteditable="true"]')
        || (event.key === ' ' && target?.closest('button, a'))) return;
      resumeUserScroll();
    }

    function onPointerDown(event: PointerEvent) {
      if (event.target === document.documentElement || event.clientX >= document.documentElement.clientWidth
        || (event.target instanceof Node && article.contains(event.target))) resumeUserScroll();
    }

    function flush() {
      if (phase === 'active' && !preservingTop && Math.abs(window.scrollY - lastScrollY) > 0.5) capture();
      persist();
    }
    const onVisibilityChange = () => { if (document.visibilityState === 'hidden') flush(); };
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        preservingTop = false;
        restore(readPosition(chapterNumber) ?? progress);
      }
    };
    const onResize = () => {
      // Barras do navegador e teclado móvel mudam a altura durante a rolagem.
      // Realinhar por resize somente quando a largura do texto mudou.
      if (window.innerWidth === viewportWidth) return;
      viewportWidth = window.innerWidth;
      realign(true);
    };
    const onLayoutChange = () => realign();
    const controls: ProgressController = {
      realign: () => realign(true),
      preserveForTop: () => {
        flush();
        cancelRestore();
        window.cancelAnimationFrame(scrollFrame);
        phase = 'active';
        preservingTop = true;
        reachedTop = window.scrollY <= 1;
        anchor = null;
      },
    };
    controller.current = controls;

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('wheel', resumeUserScroll, { passive: true });
    window.addEventListener('touchmove', resumeUserScroll, { passive: true });
    window.addEventListener('pointerdown', onPointerDown, { passive: true });
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', onResize);
    window.addEventListener('pagehide', flush);
    window.addEventListener('pageshow', onPageShow);
    document.addEventListener('visibilitychange', onVisibilityChange);
    document.fonts?.addEventListener('loadingdone', onLayoutChange);
    article.addEventListener('load', onLayoutChange, true);
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(onLayoutChange) : null;
    observer?.observe(article);
    if (article.parentElement) observer?.observe(article.parentElement);
    restore(progress);

    return () => {
      disposed = true;
      cancelRestore();
      window.cancelAnimationFrame(scrollFrame);
      // O DOM pode já pertencer ao próximo capítulo: gravar somente a última medição deste.
      persist();
      if (controller.current === controls) controller.current = null;
      observer?.disconnect();
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('wheel', resumeUserScroll);
      window.removeEventListener('touchmove', resumeUserScroll);
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('pagehide', flush);
      window.removeEventListener('pageshow', onPageShow);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      document.fonts?.removeEventListener('loadingdone', onLayoutChange);
      article.removeEventListener('load', onLayoutChange, true);
    };
  }, [chapterNumber, ready, contentRef]);

  useLayoutEffect(() => { controller.current?.realign(); }, [layoutKey]);

  const preserveForTop = useCallback(() => controller.current?.preserveForTop(), []);
  return { preserveForTop };
}
