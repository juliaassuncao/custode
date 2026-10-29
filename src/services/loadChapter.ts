import type { Chapter } from '../types';

// Vite separa cada capítulo em um arquivo carregado somente quando acessado.
const chapterModules = import.meta.glob<{ default: Chapter }>(
  '../data/chapters/chapter-*.json',
);

export async function loadChapter(number: number): Promise<Chapter | null> {
  const file = `../data/chapters/chapter-${String(number).padStart(2, '0')}.json`;
  const loader = chapterModules[file];
  if (!loader) return null;
  const module = await loader();
  return module.default;
}
