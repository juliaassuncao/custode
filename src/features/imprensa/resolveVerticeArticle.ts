import type { ChapterBlock } from '../../types';
import { publications } from './data/publications';
import { verticeArticleMetadata } from './data/verticeArticle.metadata';

export function resolveVerticeArticle(chapterNumber: number, block: ChapterBlock) {
  if (chapterNumber !== verticeArticleMetadata.chapterNumber
    || block.type !== verticeArticleMetadata.blockType
    || block.articleId !== verticeArticleMetadata.articleId) return null;

  return publications.find((publication) => publication.id === block.articleId) ?? null;
}
