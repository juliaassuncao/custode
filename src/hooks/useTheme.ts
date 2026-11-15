import { useSyncExternalStore } from 'react';

type Theme = 'light' | 'dark';
const storageKey = 'custode-theme';
const listeners = new Set<() => void>();
let manualTheme: Theme | null = null;
let stopListening: (() => void) | undefined;

function savedTheme(): Theme | null {
  try {
    const value = window.localStorage.getItem(storageKey);
    return value === 'light' || value === 'dark' ? value : null;
  } catch {
    return null;
  }
}

function getTheme(): Theme {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute(
    'content', theme === 'dark' ? '#151c18' : '#f9f6ef',
  );
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) {
    manualTheme = savedTheme();
    const preference = window.matchMedia('(prefers-color-scheme: dark)');
    const syncTheme = () => applyTheme(manualTheme ?? (preference.matches ? 'dark' : 'light'));
    const syncStoredTheme = (event: StorageEvent) => {
      if (event.key !== storageKey && event.key !== null) return;
      manualTheme = savedTheme();
      syncTheme();
    };

    preference.addEventListener('change', syncTheme);
    window.addEventListener('storage', syncStoredTheme);
    stopListening = () => {
      preference.removeEventListener('change', syncTheme);
      window.removeEventListener('storage', syncStoredTheme);
    };
    syncTheme();
  }

  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      stopListening?.();
      stopListening = undefined;
    }
  };
}

function setTheme(theme: Theme) {
  manualTheme = theme;
  applyTheme(theme);
  try {
    window.localStorage.setItem(storageKey, theme);
  } catch {
    // Mantém a escolha nesta sessão quando o navegador bloqueia o armazenamento.
  }
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, getTheme);
  return { theme, setTheme };
}
