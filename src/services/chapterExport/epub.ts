import { strToU8, zipSync } from 'fflate';
import { ChapterExportError, type ChapterDocument, type ExportBlock, type TextRun } from './content';

function xml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function inline(runs: TextRun[]): string {
  return runs.map((run) => {
    let text = xml(run.text).replace(/\n/g, '<br />');
    if (run.italics) text = `<em>${text}</em>`;
    if (run.bold) text = `<strong>${text}</strong>`;
    return text;
  }).join('');
}

function blockXhtml(block: ExportBlock): string {
  if (block.kind === 'separator' && !block.runs.length) return '<hr class="separator" />';
  const tag = block.kind === 'heading' ? 'h3' : 'p';
  const language = block.language ? ` lang="${xml(block.language)}" xml:lang="${xml(block.language)}"` : '';
  const className = block.kind === 'separator' ? 'separator' : (block.presentation ?? 'paragraph');
  return `<${tag} class="${className}"${language}>${inline(block.runs)}</${tag}>`;
}

function xhtml(title: string, body: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="pt-BR" xml:lang="pt-BR">
<head><meta charset="UTF-8" /><title>${xml(title)}</title><link rel="stylesheet" type="text/css" href="reading.css" /></head>
<body>${body}</body></html>`;
}

const readingCss = `
body { font-family: serif; font-size: 1em; line-height: 1.65; margin: 1.5em; }
h1, h2, h3 { text-align: left; line-height: 1.3; page-break-after: avoid; break-after: avoid; }
h1 { font-size: 1.8em; } h2 { margin-top: 2em; font-size: 1.3em; } h3 { margin-top: 1.5em; font-size: 1.1em; }
p { margin: 0 0 1.2em; text-align: justify; white-space: pre-wrap; overflow-wrap: break-word; hyphens: auto; orphans: 2; widows: 2; }
.byline, .eyebrow, .metadata, .caption { text-align: left; font-size: 0.9em; }
.caption { font-style: italic; } .notes { font-size: 0.92em; }
.separator { margin: 2em auto; width: 30%; text-align: center; }
hr.separator { border: 0; border-top: 1px solid currentColor; }
nav ol { padding-left: 1.5em; } nav li { margin-bottom: 0.6em; }
`;

export function createEpub(chapter: ChapterDocument): Blob {
  const title = `${chapter.workTitle} · ${chapter.title}`;
  const identifier = `urn:custode:chapter:${chapter.number}`;
  const sections = chapter.sections.map((section) => `<section id="${xml(section.id)}" class="${section.kind}"${section.kind === 'story' ? ' epub:type="chapter"' : ''}>
<h2>${xml(section.title)}</h2>${section.blocks.map(blockXhtml).join('\n')}</section>`).join('\n');
  const chapterXhtml = xhtml(title, `<header><p class="eyebrow">${xml(chapter.workTitle)} · Capítulo ${chapter.number}</p><h1>${xml(chapter.title)}</h1><p class="byline">por ${xml(chapter.author)}</p></header>${sections}`);
  const navXhtml = xhtml('Sumário', `<nav epub:type="toc" id="toc"><h1>Sumário</h1><ol>${chapter.sections.map((section) => `<li><a href="chapter.xhtml#${xml(section.id)}">${xml(section.title)}</a></li>`).join('')}</ol></nav>`);
  const container = `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="EPUB/package.opf" media-type="application/oebps-package+xml" /></rootfiles></container>`;
  const packageOpf = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="chapter-id" xml:lang="pt-BR">
<metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
<dc:identifier id="chapter-id">${xml(identifier)}</dc:identifier><dc:title>${xml(title)}</dc:title><dc:creator>${xml(chapter.author)}</dc:creator><dc:language>pt-BR</dc:language>
<dc:description>Capítulo ${chapter.number} de ${xml(chapter.workTitle)}.</dc:description><meta property="dcterms:modified">${new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')}</meta>
</metadata>
<manifest><item id="chapter" href="chapter.xhtml" media-type="application/xhtml+xml" /><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav" /><item id="css" href="reading.css" media-type="text/css" /><item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml" /></manifest>
<spine toc="ncx"><itemref idref="chapter" /></spine></package>`;
  // NCX mantém a navegação também em leitores mais antigos.
  const ncx = `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1" xml:lang="pt-BR"><head><meta name="dtb:uid" content="${xml(identifier)}" /><meta name="dtb:depth" content="1" /><meta name="dtb:totalPageCount" content="0" /><meta name="dtb:maxPageNumber" content="0" /></head><docTitle><text>${xml(title)}</text></docTitle><docAuthor><text>${xml(chapter.author)}</text></docAuthor><navMap>${chapter.sections.map((section, index) => `<navPoint id="nav-${index + 1}" playOrder="${index + 1}"><navLabel><text>${xml(section.title)}</text></navLabel><content src="chapter.xhtml#${xml(section.id)}" /></navPoint>`).join('')}</navMap></ncx>`;

  const documents = { 'META-INF/container.xml': container, 'EPUB/package.opf': packageOpf, 'EPUB/chapter.xhtml': chapterXhtml, 'EPUB/nav.xhtml': navXhtml, 'EPUB/toc.ncx': ncx };
  for (const markup of Object.values(documents)) {
    if (new DOMParser().parseFromString(markup, 'application/xml').getElementsByTagName('parsererror').length) {
      throw new ChapterExportError('Não foi possível representar todo o conteúdo do capítulo em EPUB. Nenhum arquivo foi baixado.');
    }
  }
  // OCF: mimetype precisa ser a primeira entrada, sem compressão, sem BOM ou quebra de linha.
  const archive = zipSync({
    mimetype: [strToU8('application/epub+zip'), { level: 0 }],
    ...Object.fromEntries(Object.entries(documents).map(([name, markup]) => [name, strToU8(markup)])),
    'EPUB/reading.css': strToU8(readingCss),
  });
  return new Blob([archive], { type: 'application/epub+zip' });
}
