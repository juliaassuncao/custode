import type { Chapter } from '../types';
import type { ReaderLocale, TranslationLocale } from '../i18n/locales';
import { translationRegistry } from '../data/translations/registry';
import { loadChapter } from './loadChapter';
import { translationModules as modules } from 'virtual:custode-translations';

// O Vite inclui somente caminhos finais registrados e exclui rascunhos do build.

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// Paridade estrutural impede publicar um trecho do capítulo como capítulo completo.
// Fidelidade, integralidade e qualidade linguística também exigem aprovação humana.
function validChapter(value: unknown, original: Chapter): value is Chapter {
  if (!record(value) || value.number !== original.number
    || typeof value.title !== 'string' || !value.title.trim()
    || !Array.isArray(value.blocks) || value.blocks.length !== original.blocks.length) return false;
  const safeHtml = (html: unknown) => {
    if (typeof html !== 'string' || !html.trim()) return false;
    const template = document.createElement('template');
    template.innerHTML = html;
    // O mesmo HTML inline suportado pelo leitor e pelos downloads, sem atributos ativos.
    function safeNode(node: Node): boolean {
      if (node.nodeType === Node.TEXT_NODE) return true;
      return node instanceof HTMLElement
        && ['EM', 'I', 'STRONG', 'B', 'SPAN', 'BR'].includes(node.tagName)
        && node.attributes.length === 0 && Array.from(node.childNodes).every(safeNode);
    }
    return Boolean(template.content.textContent?.trim()) && Array.from(template.content.childNodes).every(safeNode);
  };
  if (!value.blocks.every((block: unknown, index: number) => record(block)
    && block.type === original.blocks[index].type
    // Blocos que incorporam fontes externas em português precisam de suporte próprio antes de publicar.
    && (block.type === 'paragraph' || block.type === 'separator')
    && (block.type === 'separator' && (block.html === undefined || block.html === '') || safeHtml(block.html)))) return false;
  return (['chapterSummary', 'chapterNotes', 'endNotes'] as const).every((key) => {
    const notes = value[key];
    const expected = original[key]?.length ?? 0;
    return notes === undefined ? expected === 0
      : Array.isArray(notes) && notes.length === expected && notes.every(safeHtml);
  });
}

export interface TranslationLoadOptions {
  /** Somente para homologação local; ignorado incondicionalmente no build de produção. */
  previewDrafts?: boolean;
}

async function loadTranslation(original: Chapter, locale: TranslationLocale, options: TranslationLoadOptions): Promise<Chapter | null> {
  const publication = translationRegistry[locale][original.number];
  // A URL ou o chamador nunca bastam: o Vite substitui DEV por false em produção.
  const previewDraft = import.meta.env.DEV && options.previewDrafts === true && publication?.status === 'draft';
  if (!publication || (!previewDraft && (publication.status !== 'approved' || publication.complete !== true
    || typeof publication.approvedBy !== 'string' || !publication.approvedBy.trim()
    || typeof publication.approvedAt !== 'string' || !Number.isFinite(Date.parse(publication.approvedAt))
    || typeof publication.sha256 !== 'string' || !/^[a-f0-9]{64}$/i.test(publication.sha256)))) return null;
  const loader = modules[`../data/translations/${locale}/chapter-${String(original.number).padStart(2, '0')}.json`];
  if (!loader) return null;
  try {
    const raw = await loader();
    if (!previewDraft) {
      if (publication.status !== 'approved') return null;
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
      const hash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
      if (hash !== publication.sha256.toLowerCase()) return null;
    }
    const data: unknown = JSON.parse(raw);
    return validChapter(data, original) ? data : null;
  } catch {
    // JSON ausente, inválido, parcial ou alterado após aprovação: indisponível.
    return null;
  }
}

export interface ReaderChapter {
  chapter: Chapter;
  locale: ReaderLocale;
  availableLocales: ReaderLocale[];
}

export async function loadReaderChapter(number: number, requestedLocale: ReaderLocale, options: TranslationLoadOptions = {}): Promise<ReaderChapter | null> {
  const original = await loadChapter(number);
  if (!original) return null;
  const locales = ['en-US', 'es-419'] as const;
  const versions = await Promise.all(locales.map((locale) => loadTranslation(original, locale, options)));
  const availableLocales: ReaderLocale[] = ['pt-BR'];
  let chapter = original;
  let locale: ReaderLocale = 'pt-BR';
  locales.forEach((candidate, index) => {
    const translation = versions[index];
    if (!translation) return;
    availableLocales.push(candidate);
    if (requestedLocale === candidate) { chapter = translation; locale = candidate; }
  });
  return { chapter, locale, availableLocales };
}
