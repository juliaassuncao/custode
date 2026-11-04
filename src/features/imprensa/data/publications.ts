import originalArticle from './verticeArticle.json';
import { chapter28Metadata } from '../../../data/chapter28/metadata';

export interface Publication {
  id: string;
  slug: string;
  vehicle: string;
  category?: string;
  featured?: boolean;
  listed?: boolean;
  title: string;
  date: string;
  paragraphs: readonly string[];
  pullQuote?: { paragraphIndex: number; start: number; end: number };
  photo?: { src: string; alt: string; caption?: string; credit?: string };
  portrait?: Publication['photo'];
  italic?: { title?: boolean; date?: boolean; body?: boolean };
}

// Fonte definitiva: reportagem do Capítulo 28.docx enviado pela autora.
export const verticeArticle: Publication = { ...originalArticle, featured: true, listed: chapter28Metadata.listed };

export const publications: readonly Publication[] = [verticeArticle];

export function publicationPath(publication: Publication) {
  return `/imprensa/${publication.slug}`;
}
