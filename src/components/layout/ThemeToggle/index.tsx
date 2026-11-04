import { useEffect, useRef, useState } from 'react';

type Theme = 'light' | 'dark';
const storageKey = 'custode-theme';

function savedTheme(): Theme | null {
  try {
    const value = window.localStorage.getItem(storageKey);
    return value === 'light' || value === 'dark' ? value : null;
  } catch {
    return null;
  }
}

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute(
    'content', theme === 'dark' ? '#151c18' : '#f9f6ef',
  );
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(() => (
    document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'
  ));
  const manualTheme = useRef<Theme | null>(savedTheme());

  useEffect(() => {
    const preference = window.matchMedia('(prefers-color-scheme: dark)');
    const syncTheme = () => {
      const nextTheme = manualTheme.current ?? (preference.matches ? 'dark' : 'light');
      applyTheme(nextTheme);
      setTheme(nextTheme);
    };
    const syncStoredTheme = (event: StorageEvent) => {
      if (event.key !== storageKey && event.key !== null) return;
      manualTheme.current = savedTheme();
      syncTheme();
    };

    syncTheme();
    preference.addEventListener('change', syncTheme);
    window.addEventListener('storage', syncStoredTheme);
    return () => {
      preference.removeEventListener('change', syncTheme);
      window.removeEventListener('storage', syncStoredTheme);
    };
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    manualTheme.current = nextTheme;
    applyTheme(nextTheme);
    setTheme(nextTheme);
    try {
      window.localStorage.setItem(storageKey, nextTheme);
    } catch {
      // Mantém a escolha nesta sessão quando o navegador bloqueia o armazenamento.
    }
  };
  const label = theme === 'dark' ? 'Ativar modo claro' : 'Ativar modo escuro';

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggleTheme}
      aria-label={label}
      aria-pressed={theme === 'dark'}
      title={label}
    >
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
        {theme === 'light' ? (
          <path d="M20.9 13.1A9 9 0 0 1 10.9 3.1a9 9 0 1 0 10 10Z" />
        ) : (
          <>
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
          </>
        )}
      </svg>
    </button>
  );
}
