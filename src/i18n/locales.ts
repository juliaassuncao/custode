export const readerLocales = ['pt-BR', 'en-US', 'es-419'] as const;
export type ReaderLocale = typeof readerLocales[number];
export type TranslationLocale = Exclude<ReaderLocale, 'pt-BR'>;
export const originalLocale: ReaderLocale = 'pt-BR';
export const localeNames: Record<ReaderLocale, string> = {
  'pt-BR': 'Português', 'en-US': 'English', 'es-419': 'Español',
};
export function isReaderLocale(value: unknown): value is ReaderLocale {
  return readerLocales.some((locale) => locale === value);
}
