import type { Chapter } from '../../types';
import { buildChapterDocument, ChapterExportError } from './content';

import type { ReaderLocale } from '../../i18n/locales';
import { loadReaderChapter, type TranslationLoadOptions } from '../loadTranslation';

export type ChapterExportFormat = 'pdf' | 'epub';

export async function createChapterFile(chapter: Chapter, format: ChapterExportFormat, locale: ReaderLocale = 'pt-BR', options: TranslationLoadOptions = {}): Promise<Blob> {
  if (locale !== 'pt-BR') {
    const published = await loadReaderChapter(chapter.number, locale, options);
    if (!published || published.locale !== locale || JSON.stringify(published.chapter) !== JSON.stringify(chapter)) {
      throw new ChapterExportError('Esta versão ainda não está disponível. Você está lendo o original em português.');
    }
  }
  const document = await buildChapterDocument(chapter, locale);
  const blob = format === 'pdf'
    ? await (await import('./pdf')).createPdf(document)
    : (await import('./epub')).createEpub(document);

  if (!blob.size) throw new ChapterExportError('O arquivo gerado está vazio. Nenhum download foi iniciado.');
  if (format === 'pdf' && (await blob.slice(0, 5).text() !== '%PDF-' || !(await blob.slice(-1024).text()).includes('%%EOF'))) {
    throw new ChapterExportError('O PDF não foi concluído. Tente gerar o arquivo novamente.');
  }
  return blob;
}

export function downloadChapterFile(blob: Blob, number: number, format: ChapterExportFormat, locale: ReaderLocale = 'pt-BR') {
  if (!blob.size) throw new ChapterExportError('O arquivo gerado está vazio.');
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `custode-capitulo-${String(number).padStart(2, '0')}${locale === 'pt-BR' ? '' : `-${locale}`}.${format}`;
  document.body.appendChild(link);
  try {
    link.click();
  } finally {
    link.remove();
    // Dar tempo ao navegador de consumir o Blob antes de liberar a memória.
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
}
