import { useCallback, useEffect, useState } from 'react';

export type ReadingPreferences = {
  font: 'serif' | 'sans';
  size: number;
  lineHeight: number;
};

const storageKey = 'custode:reading-preferences:v1';
const defaults: ReadingPreferences = { font: 'serif', size: 19, lineHeight: 1.85 };
export const readingLimits = {
  size: { min: 16, max: 24 },
  lineHeight: { min: 1.5, max: 2.15 },
};

function normalize(value: unknown): ReadingPreferences {
  const preferences = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return {
    font: preferences.font === 'sans' ? 'sans' : defaults.font,
    size: typeof preferences.size === 'number' && Number.isFinite(preferences.size)
      ? Math.min(readingLimits.size.max, Math.max(readingLimits.size.min, Math.round(preferences.size)))
      : defaults.size,
    lineHeight: typeof preferences.lineHeight === 'number' && Number.isFinite(preferences.lineHeight)
      ? Math.min(readingLimits.lineHeight.max, Math.max(readingLimits.lineHeight.min, Number(preferences.lineHeight.toFixed(2))))
      : defaults.lineHeight,
  };
}

function savedPreferences(): ReadingPreferences {
  try {
    return normalize(JSON.parse(window.localStorage.getItem(storageKey) ?? 'null'));
  } catch {
    return defaults;
  }
}

export function useReadingPreferences() {
  const [prefs, setPrefs] = useState<ReadingPreferences>(savedPreferences);

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(prefs));
    } catch {
      // Os controles continuam funcionando quando o armazenamento está indisponível.
    }
  }, [prefs]);

  const update = useCallback((patch: Partial<ReadingPreferences>) => {
    setPrefs((previous) => normalize({ ...previous, ...patch }));
  }, []);

  return { prefs, update };
}
