import { useLayoutEffect, useRef, useState } from 'react';
import type { Chapter } from '../../types';
import type { ChapterExportFormat } from '../../services/chapterExport';

import { useReaderText } from '../../i18n/ReaderLocaleContext';
import type { ReaderLocale } from '../../i18n/locales';

export function ChapterDownloads({ chapter, locale = 'pt-BR', previewDrafts = false }: { chapter: Chapter | null; locale?: ReaderLocale; previewDrafts?: boolean }) {
  const { t } = useReaderText();
  const [processing, setProcessing] = useState<ChapterExportFormat | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const operation = useRef(0);
  const busy = useRef(false);

  useLayoutEffect(() => () => { operation.current += 1; }, []);

  async function download(format: ChapterExportFormat) {
    if (!chapter || busy.current) return;
    busy.current = true;
    const request = ++operation.current;
    setProcessing(format);
    setError('');
    setMessage(t('Preparando {format} do capítulo {number}…', { format: format.toUpperCase(), number: chapter.number }));
    try {
      // O capítulo veio de loadChapter; não coletar HTML da interface.
      const { createChapterFile, downloadChapterFile } = await import('../../services/chapterExport');
      if (request !== operation.current) return;
      await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      if (request !== operation.current) return;
      const blob = await createChapterFile(chapter, format, locale, { previewDrafts });
      // Ao navegar para outro capítulo, este componente é desmontado e a operação perde a validade.
      if (request !== operation.current) return;
      downloadChapterFile(blob, chapter.number, format, locale);
      setMessage(t('Download de {format} do capítulo {number} iniciado.', { format: format.toUpperCase(), number: chapter.number }));
    } catch (cause) {
      if (request !== operation.current) return;
      setMessage('');
      const detail = cause instanceof Error && cause.name === 'ChapterExportError' ? t(cause.message) : t('Tente novamente.');
      setError(t('Não foi possível gerar o {format}. {detail}', { format: format.toUpperCase(), detail }));
    } finally {
      if (request === operation.current) {
        busy.current = false;
        setProcessing(null);
      }
    }
  }

  return (
    <div className="chapter-downloads">
      <div className="chapter-downloads__buttons" role="group" aria-label={t('Baixar o capítulo aberto')} aria-busy={processing !== null}>
        {(['pdf', 'epub'] as const).map((format) => (
          <button
            key={format}
            type="button"
            className="chapter-downloads__button"
            disabled={!chapter || processing !== null}
            aria-label={chapter ? t('Baixar {format} do capítulo {number}', { format: format.toUpperCase(), number: chapter.number }) : t('Baixar {format}', { format: format.toUpperCase() })}
            onClick={() => { void download(format); }}
          >
            {t(processing === format ? 'Gerando {format}…' : 'Baixar {format}', { format: format.toUpperCase() })}
          </button>
        ))}
      </div>
      <p className="chapter-downloads__status" role="status" aria-atomic="true">{message}</p>
      {error && <p className="chapter-downloads__error" role="alert">{error}</p>}
    </div>
  );
}
