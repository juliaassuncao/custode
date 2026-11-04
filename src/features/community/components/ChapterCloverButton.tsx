import { CloverIcon } from './CloverIcon';
import type { ReactNode } from 'react';
type Props = { count: number; hasLeft: boolean; ready: boolean; disabled: boolean; onLeave(): void; children?: ReactNode };
export function ChapterCloverButton({ count, hasLeft, ready, disabled, onLeave, children }: Props) {
  return <section className={`chapter-community__clover${hasLeft ? ' chapter-community__clover--active' : ''}`} aria-label="Trevos do capítulo">
    <div className="chapter-clover-summary">
      <div className="chapter-clover-summary__count"><CloverIcon />
        <div><span className="chapter-community__count">{ready ? count.toLocaleString('pt-BR') : '—'}</span>
          <span className="chapter-clover-summary__caption">{count === 1 && ready ? 'trevo recebido' : 'trevos recebidos'}</span></div>
      </div>
      <div className="chapter-clover-summary__action"><h2>Um trevo para este capítulo</h2>
      <button type="button" className={`chapter-clover${hasLeft ? ' chapter-clover--active' : ''}`}
        disabled={!ready || disabled || hasLeft} aria-pressed={hasLeft} onClick={onLeave}
        aria-label={`${hasLeft ? 'Você deixou um trevo' : 'Deixar um trevo'}${ready ? ` · ${count} ${count === 1 ? 'trevo' : 'trevos'} neste capítulo` : ''}`}>
        <span className="chapter-clover__label">{hasLeft ? 'Você deixou um trevo' : 'Deixar um trevo'}</span>
      </button>
      </div>
    </div>
    {children}
  </section>;
}
