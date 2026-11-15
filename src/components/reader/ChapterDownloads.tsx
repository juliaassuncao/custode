import { useLayoutEffect, useRef, useState } from 'react';
import type { Chapter } from '../../types';
import type { ChapterExportFormat } from '../../services/chapterExport';

export function ChapterDownloads({ chapter }: { chapter: Chapter | null }) {
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
    setMessage(`Preparando ${format.toUpperCase()} do capítulo ${chapter.number}…`);
    try {
      // O capítulo veio de loadChapter; não coletar HTML da interface.
      const { createChapterFile, downloadChapterFile } = await import('../../services/chapterExport');
      if (request !== operation.current) return;
      await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      if (request !== operation.current) return;
      const blob = await createChapterFile(chapter, format);
      // Ao navegar para outro capítulo, este componente é desmontado e a operação perde a validade.
      if (request !== operation.current) return;
      downloadChapterFile(blob, chapter.number, format);
      setMessage(`Download de ${format.toUpperCase()} do capítulo ${chapter.number} iniciado.`);
    } catch (cause) {
      if (request !== operation.current) return;
      setMessage('');
      const detail = cause instanceof Error && cause.name === 'ChapterExportError' ? cause.message : 'Tente novamente.';
      setError(`Não foi possível gerar o ${format.toUpperCase()}. ${detail}`);
    } finally {
      if (request === operation.current) {
        busy.current = false;
        setProcessing(null);
      }
    }
  }

  return (
    <div className="chapter-downloads">
      <div className="chapter-downloads__buttons" role="group" aria-label="Baixar o capítulo aberto" aria-busy={processing !== null}>
        {(['pdf', 'epub'] as const).map((format) => (
          <button
            key={format}
            type="button"
            className="chapter-downloads__button"
            disabled={!chapter || processing !== null}
            aria-label={`Baixar ${format.toUpperCase()}${chapter ? ` do capítulo ${chapter.number}` : ' do capítulo aberto'}`}
            onClick={() => { void download(format); }}
          >
            {processing === format ? `Gerando ${format.toUpperCase()}…` : `Baixar ${format.toUpperCase()}`}
          </button>
        ))}
      </div>
      <p className="chapter-downloads__status" role="status" aria-atomic="true">{message}</p>
      {error && <p className="chapter-downloads__error" role="alert">{error}</p>}
    </div>
  );
}
