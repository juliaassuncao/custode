import { readerText } from '../../i18n/messages';
import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';
import type { Content, ContentText, TDocumentDefinitions } from 'pdfmake/interfaces';
import type { ChapterDocument, ExportBlock, ExportSection } from './content';

pdfMake.addVirtualFileSystem(pdfFonts);
pdfMake.addFonts({
  Roboto: {
    normal: 'Roboto-Regular.ttf',
    bold: 'Roboto-Medium.ttf',
    italics: 'Roboto-Italic.ttf',
    bolditalics: 'Roboto-MediumItalic.ttf',
  },
});

function blockContent(block: ExportBlock, section: ExportSection): Content {
  if (block.kind === 'separator' && !block.runs.length) {
    return {
      canvas: [{ type: 'line', x1: 188, y1: 0, x2: 308, y2: 0, lineWidth: 0.7, lineColor: '#74866e' }],
      margin: [0, 18, 0, 24],
    };
  }
  const content: ContentText = {
    text: block.runs,
    preserveLeadingSpaces: true,
    margin: [0, 0, 0, 11],
    alignment: 'justify',
  };
  if (section.kind !== 'story') {
    content.fontSize = 10;
    content.color = '#50584e';
  }
  if (block.kind === 'heading') {
    content.headlineLevel = 3;
    content.fontSize = 14;
    content.bold = true;
    content.alignment = 'left';
    content.margin = [0, 18, 0, 10];
  } else if (block.kind === 'separator') {
    content.alignment = 'center';
    content.margin = [0, 18, 0, 24];
  } else if (block.presentation) {
    content.fontSize = 9;
    content.alignment = 'left';
    content.color = '#50584e';
    if (block.presentation === 'caption') content.italics = true;
  }
  return content;
}

export async function createPdf(chapter: ChapterDocument): Promise<Blob> {
  const label = readerText(chapter.locale, 'Capítulo {number}', { number: chapter.number });
  const content: Content[] = [
    { text: `${chapter.workTitle} · ${label}`, color: '#425a44', fontSize: 11, margin: [0, 0, 0, 14] },
    { text: chapter.title, fontSize: 24, bold: true, margin: [0, 0, 0, 8] },
    { text: `${readerText(chapter.locale, 'por')} ${chapter.author}`, color: '#50584e', fontSize: 10, margin: [0, 0, 0, 28] },
  ];

  for (const section of chapter.sections) {
    content.push({
      text: section.kind === 'story' ? label : section.title,
      headlineLevel: 2,
      fontSize: section.kind === 'story' ? 16 : 12,
      bold: true,
      color: '#425a44',
      margin: [0, 16, 0, 14],
    });
    content.push(...section.blocks.map((block) => blockContent(block, section)));
  }

  const definition: TDocumentDefinitions = {
    info: { title: `${chapter.workTitle} · ${chapter.title}`, author: chapter.author, subject: label, creator: 'Custode' },
    pageSize: 'A4',
    pageMargins: [50, 54, 50, 54],
    defaultStyle: { font: 'Roboto', fontSize: 11, lineHeight: 1.55, color: '#242622' },
    content,
    pageBreakBefore: (node, queries) => Boolean(node.headlineLevel && !queries.getFollowingNodesOnPage().length),
    footer: (page, pages) => ({ text: `${page} / ${pages}`, alignment: 'center', fontSize: 9, color: '#666b63', margin: [0, 18, 0, 0] }),
  };
  return pdfMake.createPdf(definition).getBlob();
}
