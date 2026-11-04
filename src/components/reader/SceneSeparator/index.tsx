import type { ChapterBlock } from '../../../types';

export function isSceneSeparator(block: ChapterBlock) {
  if (block.type !== 'paragraph' && block.type !== 'separator') return false;
  // Os capítulos anteriores já possuem separadores sem conteúdo textual.
  if (block.type === 'separator' && !block.html?.trim()) return true;

  // Ignorar apenas a formatação inline; conteúdo adicional impede a substituição.
  const text = (block.html ?? '').replace(/<\/?(?:em|strong|b|i|span)(?:\s[^>]*)?>/gi, '');
  return text.trim() === '###';
}

export function SceneSeparator() {
  return (
    <div className="chapter-content__separator" role="separator" aria-label="Mudança de cena">
      <span aria-hidden="true" />
    </div>
  );
}
