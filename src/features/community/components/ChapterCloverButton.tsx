import { useReaderText } from '../../../i18n/ReaderLocaleContext';
import { CloverIcon } from './CloverIcon';
import type { ReactNode } from 'react';
type Props = { count: number; hasLeft: boolean; ready: boolean; disabled: boolean; onLeave(): void; children?: ReactNode };
export function ChapterCloverButton({ count, hasLeft, ready, disabled, onLeave, children }: Props) {
  const { locale, t } = useReaderText();
  return <section className={`chapter-community__clover${hasLeft ? ' chapter-community__clover--active' : ''}`} aria-label={t('Trevos do capítulo')}>
    <div className="chapter-clover-summary">
      <div className="chapter-clover-summary__count"><CloverIcon />
        <div><span className="chapter-community__count">{ready ? count.toLocaleString(locale) : '—'}</span>
          <span className="chapter-clover-summary__caption">{count === 1 && ready ? t('trevo recebido') : t('trevos recebidos')}</span></div>
      </div>
      <div className="chapter-clover-summary__action"><h2>{t('Um trevo para este capítulo')}</h2>
      <button type="button" className={`chapter-clover${hasLeft ? ' chapter-clover--active' : ''}`}
        disabled={!ready || disabled || hasLeft} aria-pressed={hasLeft} onClick={onLeave}
        aria-label={`${hasLeft ? t('Você deixou um trevo') : t('Deixar um trevo')}${ready ? ` · ${t(count === 1 ? '{count} trevo neste capítulo' : '{count} trevos neste capítulo', { count })}` : ''}`}>
        <span className="chapter-clover__label">{hasLeft ? t('Você deixou um trevo') : t('Deixar um trevo')}</span>
      </button>
      </div>
    </div>
    {children}
  </section>;
}
