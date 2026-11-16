import { useRef } from 'react';
import { useReaderText } from '../../../i18n/ReaderLocaleContext';

type Props = {
  page: number;
  totalPages: number;
  loading: boolean;
  disabled: boolean;
  commentsId: string;
  onPageChange(page: number): Promise<boolean>;
};

export function CommunityPagination({ page, totalPages, loading, disabled, commentsId, onPageChange }: Props) {
  const { t } = useReaderText();
  const navigation = useRef<HTMLElement>(null);
  if (totalPages <= 1) return null;

  const pages = totalPages <= 5 ? Array.from({ length: totalPages }, (_, index) => index + 1)
    : [...new Set([1, page - 1, page, page + 1, totalPages])]
      .filter((number) => number >= 1 && number <= totalPages).sort((a, b) => a - b);
  async function changePage(target: number) {
    if (!await onPageChange(target)) return;
    // The clicked control may become disabled or disappear on the last valid page.
    requestAnimationFrame(() => {
      const current = navigation.current?.querySelector<HTMLButtonElement>('[aria-current="page"]');
      (current ?? document.getElementById(commentsId))?.focus({ preventScroll: true });
    });
  }
  const unavailable = disabled || loading;
  return <nav ref={navigation} className="community-pagination" aria-label={t('Paginação dos comentários')}>
    <div className="community-pagination__controls">
      <button className="community-button community-button--secondary" type="button" aria-controls={commentsId}
        disabled={unavailable || page === 1} onClick={() => void changePage(page - 1)}>{t('Anterior')}</button>
      <div className="community-pagination__pages">
        {pages.map((number, index) => <span className="community-pagination__item" key={number}>
          {index > 0 && number - pages[index - 1] > 1 && <span className="community-pagination__ellipsis" aria-hidden="true">…</span>}
          <button className={`community-button${number === page ? '' : ' community-button--secondary'}`} type="button"
            aria-controls={commentsId} aria-current={number === page ? 'page' : undefined}
            aria-label={t('Ir para a página {page}', { page: number })} disabled={unavailable}
            onClick={() => void changePage(number)}>{number}</button>
        </span>)}
      </div>
      <button className="community-button community-button--secondary" type="button" aria-controls={commentsId}
        disabled={unavailable || page === totalPages} onClick={() => void changePage(page + 1)}>{t('Próxima')}</button>
    </div>
    <p className="community-pagination__status" role="status">{t('Página {page} de {total}', { page, total: totalPages })}</p>
  </nav>;
}
