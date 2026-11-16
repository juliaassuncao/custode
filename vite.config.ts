import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { existsSync } from 'node:fs';
import { translationRegistry } from './src/data/translations/registry';

export default defineConfig(({ command }) => ({
  plugins: [react(), {
    name: 'custode-translation-modules',
    resolveId(id) {
      if (id === 'virtual:custode-translations') return '\0custode-translations';
    },
    load(id) {
      if (id !== '\0custode-translations') return;
      const entries: string[] = [];
      for (const [locale, chapters] of Object.entries(translationRegistry)) {
        for (const [number, publication] of Object.entries(chapters)) {
          if (!/^\d+$/.test(number) || Number(number) < 1 || !publication) continue;
          // Rascunhos nem sequer integram os assets do build de produção.
          if (command !== 'serve' && publication.status !== 'approved') continue;
          const path = `data/translations/${locale}/chapter-${number.padStart(2, '0')}.json`;
          if (!existsSync(new URL(`./src/${path}`, import.meta.url))) continue;
          entries.push(`${JSON.stringify(`../${path}`)}: () => import(${JSON.stringify(`/src/${path}?raw`)}).then(module => module.default)`);
        }
      }
      return `export const translationModules = {${entries.join(',')}};`;
    },
  }],
}));
