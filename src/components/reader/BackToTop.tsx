import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { ArrowUp } from 'lucide-react';

export function BackToTop({ readerRef, topRef, onBeforeScroll }: {
  readerRef: RefObject<HTMLElement>;
  topRef: RefObject<HTMLElement>;
  onBeforeScroll: () => void;
}) {
  const position = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const box = position.current?.getBoundingClientRect();
        const reader = readerRef.current;
        if (!box || !reader || window.scrollY <= 400) { setVisible(false); return; }
        const editing = document.activeElement instanceof Element
          && Boolean(document.activeElement.closest('input, textarea, select, [contenteditable="true"]'));
        // Nos espaços estreitos, ocultar o botão quando ele coincidir com a comunidade ou controles.
        const overlapsControl = Array.from(document.querySelectorAll<HTMLElement>(
          '.chapter-community, form, a, button, input, textarea, select, iframe, [role="dialog"]',
        )).some((control) => {
          if (position.current?.contains(control)) return false;
          const rect = control.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0 && rect.left < box.right + 8 && rect.right > box.left - 8
            && rect.top < box.bottom + 8 && rect.bottom > box.top - 8;
        });
        setVisible(!editing && !overlapsControl);
      });
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    window.visualViewport?.addEventListener('resize', update);
    document.addEventListener('focusin', update);
    document.addEventListener('focusout', update);
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;
    if (readerRef.current) observer?.observe(readerRef.current);
    return () => {
      window.cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      window.visualViewport?.removeEventListener('resize', update);
      document.removeEventListener('focusin', update);
      document.removeEventListener('focusout', update);
    };
  }, [readerRef]);

  return (
    <div ref={position} className="reader-back-to-top">
      <button
        type="button"
        className="reader-back-to-top__button"
        hidden={!visible}
        aria-label="Voltar ao topo"
        title="Voltar ao topo"
        onClick={() => {
          onBeforeScroll();
          topRef.current?.focus({ preventScroll: true });
          window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
        }}
      >
        <ArrowUp size={20} aria-hidden="true" />
      </button>
    </div>
  );
}
