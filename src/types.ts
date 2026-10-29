export interface ChapterBlock {
  type: 'paragraph' | 'separator';
  html?: string;
}

export interface Chapter {
  number: number;
  title: string;
  blocks: ChapterBlock[];
  chapterNotes?: string[];
  chapterSummary?: string[];
  endNotes?: string[];
}

export interface ChapterMetadata {
  number: number;
  title: string;
  words: number;
  paragraphs: number;
}

export interface WorkInfo {
  title: string;
  author: string;
  sourceFile: string;
  summary: string;
  introNotes?: string;
  ao3Url: string;
}
