import work from '../../data/chapters/work.json';
import type { Chapter } from '../../types';
import { isSceneSeparator } from '../../components/reader/SceneSeparator';

export interface TextRun {
  text: string;
  bold?: boolean;
  italics?: boolean;
}

export interface ExportBlock {
  kind: 'paragraph' | 'heading' | 'separator';
  runs: TextRun[];
  presentation?: 'metadata' | 'caption';
  language?: string;
}

export interface ExportSection {
  id: string;
  title: string;
  kind: 'notes' | 'story';
  blocks: ExportBlock[];
}

export interface ChapterDocument {
  number: number;
  title: string;
  workTitle: string;
  author: string;
  sections: ExportSection[];
}

export class ChapterExportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ChapterExportError';
  }
}

// Interpretar somente o HTML canônico, nunca o DOM do leitor ou da comunidade.
export function parseInlineHtml(html: string): TextRun[] {
  const template = document.createElement('template');
  template.innerHTML = html;
  const runs: TextRun[] = [];

  function append(text: string, bold: boolean, italics: boolean) {
    const previous = runs[runs.length - 1];
    if (previous && previous.bold === bold && previous.italics === italics) {
      previous.text += text;
    } else {
      runs.push({ text, bold, italics });
    }
  }

  function visit(node: Node, bold = false, italics = false) {
    if (node.nodeType === Node.TEXT_NODE) {
      append(node.textContent ?? '', bold, italics);
      return;
    }
    if (!(node instanceof HTMLElement)) {
      throw new ChapterExportError('O capítulo contém uma marcação que não pode ser exportada integralmente.');
    }
    const tag = node.tagName.toLowerCase();
    if (tag === 'br') {
      append('\n', bold, italics);
      return;
    }
    if (!['em', 'i', 'strong', 'b', 'span'].includes(tag)) {
      throw new ChapterExportError('O capítulo contém uma formatação ainda não suportada para download.');
    }
    node.childNodes.forEach((child) => visit(child, bold || tag === 'strong' || tag === 'b', italics || tag === 'em' || tag === 'i'));
  }

  template.content.childNodes.forEach((node) => visit(node));
  return runs.length ? runs : [{ text: '' }];
}

export function paragraphFromHtml(html: string): ExportBlock {
  return { kind: 'paragraph', runs: parseInlineHtml(html) };
}

export function textBlock(text: string, options: Partial<Omit<ExportBlock, 'runs'>> = {}, style: Omit<TextRun, 'text'> = {}): ExportBlock {
  return { kind: 'paragraph', ...options, runs: [{ text, ...style }] };
}

export async function buildChapterDocument(chapter: Chapter): Promise<ChapterDocument> {
  if (!Number.isInteger(chapter.number) || chapter.number < 1 || !chapter.title.trim() || !chapter.blocks.length) {
    throw new ChapterExportError('Os dados do capítulo estão incompletos. Recarregue a página e tente novamente.');
  }

  const sections: ExportSection[] = [];
  function notes(id: string, title: string, paragraphs?: string[]) {
    if (paragraphs?.length) {
      sections.push({ id, title, kind: 'notes', blocks: paragraphs.map(paragraphFromHtml) });
    }
  }

  if (chapter.number === 1 && work.introNotes) {
    notes('introducao', 'Nota da autora', work.introNotes.split(/\n\s*\n/));
  }
  notes('resumo', 'Resumo do capítulo', chapter.chapterSummary);
  notes('notas-iniciais', 'Notas da autora', chapter.chapterNotes);

  const blocks: ExportBlock[] = [];
  const specialContent = chapter.blocks.some((block) => !['paragraph', 'separator'].includes(block.type))
    ? await import('./specialBlocks')
    : null;

  for (const block of chapter.blocks) {
    if (isSceneSeparator(block)) {
      blocks.push({ kind: 'separator', runs: [] });
    } else if (block.type === 'paragraph' || block.type === 'separator') {
      if (typeof block.html !== 'string') {
        throw new ChapterExportError('Um trecho do capítulo está sem conteúdo. O download foi interrompido.');
      }
      blocks.push({ ...paragraphFromHtml(block.html), kind: block.type === 'separator' ? 'separator' : 'paragraph' });
    } else if (specialContent) {
      blocks.push(...specialContent.exportSpecialBlock(chapter.number, block));
    } else {
      throw new ChapterExportError('Um bloco do capítulo não pôde ser exportado integralmente.');
    }
  }
  if (!blocks.some((block) => block.runs.some((run) => run.text.trim()))) {
    throw new ChapterExportError('O capítulo não possui texto disponível para download.');
  }
  sections.push({ id: 'historia', title: chapter.title, kind: 'story', blocks });
  notes('notas-finais', 'Notas finais da autora', chapter.endNotes);

  return { number: chapter.number, title: chapter.title, workTitle: work.title, author: work.author, sections };
}
