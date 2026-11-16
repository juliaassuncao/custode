import { Link, useNavigate } from 'react-router-dom';
import { listedChapters } from '../../../data/chapter28/metadata';

import type { ReaderLocale } from '../../../i18n/locales';
import { useReaderText } from '../../../i18n/ReaderLocaleContext';

interface Props {
  current: number;
  requestedLocale?: ReaderLocale;
  previewDrafts?: boolean;
  placement?: 'top' | 'bottom';
}

export function ChapterNavigation({ current, requestedLocale, previewDrafts = false, placement = 'top' }: Props) {
  const navigate = useNavigate();
  const { locale, t } = useReaderText();
  // Preservar a preferência mesmo ao passar por um capítulo disponível apenas em português.
  const targetLocale = requestedLocale ?? locale;
  const chapterUrl = (number: number | string) => {
    const params = new URLSearchParams();
    if (targetLocale !== 'pt-BR') params.set('lang', targetLocale);
    if (import.meta.env.DEV && previewDrafts) params.set('preview', 'translations');
    const search = params.toString();
    return `/capitulo/${number}${search ? `?${search}` : ''}`;
  };
  const last = listedChapters.length;

  return (
    <nav className={`chapter-nav chapter-nav--${placement}`} aria-label={t('Navegação de capítulos ({placement})', { placement: t(placement) })}>
      <div className="chapter-nav__links">
        {current > 1 ? (
          <Link to={chapterUrl(current - 1)} className="nav-button">← {t('Anterior')}</Link>
        ) : (
          <span className="nav-button nav-button--disabled" aria-disabled="true">← {t('Anterior')}</span>
        )}
        {current < last ? (
          <Link to={chapterUrl(current + 1)} className="nav-button">{t('Próximo')} →</Link>
        ) : (
          <span className="nav-button nav-button--disabled" aria-disabled="true">{t('Próximo')} →</span>
        )}
      </div>
      <label className="chapter-nav__select-label">
        <span>{t('Ir para o capítulo')}</span>
        <select value={listedChapters.some((chapter) => chapter.number === current) ? current : ''} onChange={(event) => navigate(chapterUrl(event.target.value))}>
          {!listedChapters.some((chapter) => chapter.number === current) && <option value="" disabled hidden>{t('Ir para o capítulo')}</option>}
          {listedChapters.map((chapter) => (
            <option key={chapter.number} value={chapter.number}>{t('Capítulo {number}', { number: chapter.number })}</option>
          ))}
        </select>
      </label>
    </nav>
  );
}
