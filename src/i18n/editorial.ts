import type { TranslationLocale } from './locales';

// Avisos editoriais independentes das notas da autora. Preservar o texto aprovado.
export const translationEditorialNotices: Record<TranslationLocale, string> = {
  'en-US': 'This English translation was created with AI assistance and is still being reviewed and refined. We welcome feedback on wording, tone, and accuracy, especially from native speakers. Thank you for helping us improve it!',
  'es-419': 'Esta traducción al español se realizó con ayuda de inteligencia artificial y todavía está en proceso de revisión y mejora. Agradecemos sugerencias sobre la naturalidad, el tono y la fidelidad al original, especialmente de hablantes nativos. ¡Gracias por ayudarnos a mejorarla!',
};
