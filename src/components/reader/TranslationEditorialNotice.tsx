import type { ReaderLocale } from '../../i18n/locales';
import { readerText } from '../../i18n/messages';
import { translationEditorialNotices } from '../../i18n/editorial';
import { translationFeedbackUrl } from '../../data/translations/registry';

export function TranslationEditorialNotice({ locale }: { locale: ReaderLocale }) {
  if (locale === 'pt-BR') return null;
  const url = translationFeedbackUrl(locale);
  return <aside className="translation-notice" lang={locale} aria-label={readerText(locale, 'Aviso sobre a tradução')}>
    <p>{translationEditorialNotices[locale]}</p>
    {url && <a href={url} target="_blank" rel="noopener noreferrer">{readerText(locale, 'Enviar feedback da tradução')}</a>}
  </aside>;
}
