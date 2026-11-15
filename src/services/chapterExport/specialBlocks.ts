import type { ChapterBlock } from '../../types';
import tweets from '../../data/chapter28/tweets.json';
import headlines from '../../data/chapter28/headlines.json';
import { chapter28Metadata } from '../../data/chapter28/metadata';
import { resolveVerticeArticle } from '../../features/imprensa/resolveVerticeArticle';
import type { Publication } from '../../features/imprensa/data/publications';
import { ChapterExportError, paragraphFromHtml, textBlock, type ExportBlock } from './content';

function photoText(photo: Publication['photo']): ExportBlock[] {
  if (!photo) return [];
  // Fotografias são representadas por seus textos originais nesta edição de leitura.
  return [photo.alt, photo.caption, photo.credit]
    .filter((text): text is string => Boolean(text))
    .map((text) => textBlock(text, { presentation: 'caption' }));
}

export function exportSpecialBlock(chapterNumber: number, block: ChapterBlock): ExportBlock[] {
  switch (block.type) {
    case 'verticeArticle': {
      const article = resolveVerticeArticle(chapterNumber, block);
      if (!article?.paragraphs.length) {
        throw new ChapterExportError('A reportagem deste capítulo não pôde ser encontrada. Nenhum arquivo foi baixado.');
      }
      const blocks = [
        textBlock(article.vehicle, { kind: 'heading' }),
        ...(article.category ? [textBlock(article.category, { presentation: 'metadata' })] : []),
        textBlock(article.date, { presentation: 'metadata' }, { bold: Boolean(article.italic?.date), italics: Boolean(article.italic?.date) }),
        textBlock(article.title, { kind: 'heading' }, { bold: true, italics: Boolean(article.italic?.title) }),
        ...photoText(article.photo),
      ];
      article.paragraphs.forEach((paragraph, index) => {
        // A citação destacada já está contida no parágrafo original: não a duplicar nem recortar.
        blocks.push(textBlock(paragraph, {}, { italics: Boolean(article.italic?.body) }));
        if (index === 1) blocks.push(...photoText(article.portrait));
      });
      return blocks;
    }
    case 'socialPosts':
      if (chapterNumber !== chapter28Metadata.number || !tweets.length) break;
      return [
        textBlock('Publicações no X', { kind: 'heading' }),
        ...tweets.flatMap((tweet) => [textBlock(tweet.username, {}, { bold: true }), paragraphFromHtml(tweet.html)]),
      ];
    case 'internationalHeadlines':
      if (chapterNumber !== chapter28Metadata.number || !headlines.length) break;
      return [
        textBlock('Manchetes internacionais', { kind: 'heading' }),
        ...headlines.map((headline) => ({ ...paragraphFromHtml(headline.html), language: headline.language })),
      ];
  }
  throw new ChapterExportError('Um bloco especial deste capítulo ainda não possui uma representação completa para download.');
}
