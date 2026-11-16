import { useId } from 'react';
import { localeNames, readerLocales, type ReaderLocale } from '../../i18n/locales';
import { useReaderText } from '../../i18n/ReaderLocaleContext';

export function ReaderLanguageSelector({ value, availableLocales, onChange, disabled }: {
  value: ReaderLocale;
  availableLocales: ReaderLocale[];
  onChange(locale: ReaderLocale): void;
  disabled: boolean;
}) {
  const id = useId();
  const { t } = useReaderText();
  return <label className="reader-language" htmlFor={id}>
    <span>{t('Idioma')}</span>
    <select id={id} value={value} disabled={disabled} onChange={(event) => onChange(event.target.value as ReaderLocale)}>
      {readerLocales.map((locale) => <option key={locale} value={locale} lang={locale} disabled={!availableLocales.includes(locale)}>
        {localeNames[locale]}{availableLocales.includes(locale) ? '' : ` · ${t('Indisponível')}`}
      </option>)}
    </select>
  </label>;
}
