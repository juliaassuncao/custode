import { useId, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Minus, Plus, Moon, Sun, AlignLeft } from 'lucide-react';
import { readingLimits, type ReadingPreferences } from '../../hooks/useReadingPreferences';
import { useTheme } from '../../hooks/useTheme';
import { useReaderText } from '../../i18n/ReaderLocaleContext';
import styles from './ReadingControls.module.scss';

type ReadingControlsProps = {
  value: ReadingPreferences;
  onChange: (patch: Partial<ReadingPreferences>) => void;
  actions?: ReactNode;
};

export function ReadingControls({ value, onChange, actions }: ReadingControlsProps) {
  const { t } = useReaderText();
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const { theme, setTheme } = useTheme();

  return (
    <div className="reading-controls" onKeyDown={(event) => {
      if (event.key === 'Escape' && open) {
        event.preventDefault();
        setOpen(false);
        trigger.current?.focus();
      }
    }}>
      <div className="reading-controls__toolbar">
        <button
          ref={trigger}
          type="button"
          className="reading-controls__toggle"
          aria-label={t('Ajustes de leitura')}
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((previous) => !previous)}
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true" focusable="false">
            <path d="M4 7h9m4 0h3M4 17h3m4 0h9" />
            <circle cx="15" cy="7" r="2" /><circle cx="9" cy="17" r="2" />
          </svg>
          {t('Ajustes de leitura')}
        </button>
        {actions}
      </div>
      <div id={panelId} className={`reading-controls__panel ${styles.controls}`} role="group" aria-label={t('Preferências de leitura')} hidden={!open}>
        <div className={styles.group}>
          <span className={styles.legend}>{t('TEMA')}</span>
          <button type="button" className={theme === 'light' ? styles.selected : ''} onClick={() => setTheme('light')} title={t('Tema claro')} aria-label={t('Tema claro')} aria-pressed={theme === 'light'}><Sun size={17} aria-hidden="true" /></button>
          <button type="button" className={theme === 'dark' ? styles.selected : ''} onClick={() => setTheme('dark')} title={t('Tema escuro')} aria-label={t('Tema escuro')} aria-pressed={theme === 'dark'}><Moon size={17} aria-hidden="true" /></button>
        </div>
        <div className={styles.group}>
          <span className={styles.legend}>{t('FONTE')}</span>
          <button type="button" className={value.font === 'serif' ? styles.selected : ''} onClick={() => onChange({ font: 'serif' })} aria-label={t('Fonte serifada')} aria-pressed={value.font === 'serif'}><span className={styles.serif}>Aa</span></button>
          <button type="button" className={value.font === 'sans' ? styles.selected : ''} onClick={() => onChange({ font: 'sans' })} aria-label={t('Fonte sem serifa')} aria-pressed={value.font === 'sans'}>Aa</button>
        </div>
        <div className={styles.group}>
          <span className={styles.legend}>{t('TAMANHO')}</span>
          <button type="button" onClick={() => onChange({ size: value.size - 1 })} disabled={value.size <= readingLimits.size.min} aria-label={t('Diminuir fonte')}><Minus size={17} aria-hidden="true" /></button>
          <output className={styles.value} aria-live="polite" aria-atomic="true" aria-label={t('Tamanho da fonte')}>{value.size}</output>
          <button type="button" onClick={() => onChange({ size: value.size + 1 })} disabled={value.size >= readingLimits.size.max} aria-label={t('Aumentar fonte')}><Plus size={17} aria-hidden="true" /></button>
        </div>
        <div className={styles.group}>
          <span className={styles.legend}>{t('ENTRELINHA')}</span>
          <AlignLeft size={16} className={styles.alignIcon} aria-hidden="true" />
          <button type="button" onClick={() => onChange({ lineHeight: value.lineHeight - 0.1 })} aria-label={t('Diminuir entrelinha')} disabled={value.lineHeight <= readingLimits.lineHeight.min}><Minus size={17} aria-hidden="true" /></button>
          <button type="button" onClick={() => onChange({ lineHeight: value.lineHeight + 0.1 })} aria-label={t('Aumentar entrelinha')} disabled={value.lineHeight >= readingLimits.lineHeight.max}><Plus size={17} aria-hidden="true" /></button>
        </div>
      </div>
    </div>
  );
}
