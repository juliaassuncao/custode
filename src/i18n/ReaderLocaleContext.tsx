import { createContext, useContext } from 'react';
import type { ReaderLocale } from './locales';
import { readerText } from './messages';

export const ReaderLocaleContext = createContext<ReaderLocale>('pt-BR');
export function useReaderText() {
  const locale = useContext(ReaderLocaleContext);
  return { locale, t: (message: string, values?: Record<string, string | number>) => readerText(locale, message, values) };
}
