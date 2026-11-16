import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { isReaderLocale, type ReaderLocale } from '../i18n/locales';

const storageKey = 'custode:reader-language:v1';
function savedLocale(): ReaderLocale {
  try {
    const value = window.localStorage.getItem(storageKey);
    return isReaderLocale(value) ? value : 'pt-BR';
  } catch { return 'pt-BR'; }
}

export function useReaderLanguage() {
  const [params, setParams] = useSearchParams();
  const explicit = params.get('lang');
  // Esta opção não é persistida e não tem efeito em produção ou em vite preview.
  const previewDrafts = import.meta.env.DEV && params.get('preview') === 'translations';
  // Um parâmetro desconhecido nunca herda silenciosamente a preferência salva.
  const requestedLocale = explicit === null ? savedLocale() : isReaderLocale(explicit) ? explicit : 'pt-BR';
  useEffect(() => {
    if (!isReaderLocale(explicit)) return;
    try { window.localStorage.setItem(storageKey, explicit); } catch { /* Preferência opcional. */ }
  }, [explicit]);
  function selectLocale(locale: ReaderLocale) {
    try { window.localStorage.setItem(storageKey, locale); } catch { /* Preferência opcional. */ }
    const next = new URLSearchParams(params);
    next.set('lang', locale);
    setParams(next, { preventScrollReset: true });
  }
  return { requestedLocale, selectLocale, previewDrafts, unsupportedLocale: explicit !== null && !isReaderLocale(explicit) };
}
