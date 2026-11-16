import type { TranslationLocale } from '../../i18n/locales';

type Publication = { status: 'draft' } | {
  status: 'approved';
  complete: true;
  approvedBy: string;
  approvedAt: string;
  /** SHA-256 dos bytes do JSON integral aprovado; qualquer alteração exige nova aprovação. */
  sha256: string;
};

// Aprovação de publicação beta assistida por IA pela responsável pelo portal.
// Não certifica revisão linguística nativa nem aprovação integral das traduções pela autora.
// O carregador também exige arquivo integral, hash e validação estrutural.
export const translationRegistry: Record<TranslationLocale, Partial<Record<number, Publication>>> = {
  'en-US': {
    30: {
      status: 'approved',
      complete: true,
      approvedBy: 'Julia Assunção (@itsxulia)',
      approvedAt: '2026-11-16T00:58:27Z',
      sha256: '001bebc876ea972dd9d972bc9fc44c81cc65b27b578674c960e1ead584f1d088',
    },
  },
  'es-419': {
    30: {
      status: 'approved',
      complete: true,
      approvedBy: 'Julia Assunção (@itsxulia)',
      approvedAt: '2026-11-16T00:58:27Z',
      sha256: '36600936c8894833c3b7f06a331cf01e27f04f080eb3381e8ecc695912aa76af',
    },
  },
};

// Preencher somente quando houver um endereço real. Aceitamos apenas links HTTPS.
export const translationFeedbackUrls: Partial<Record<TranslationLocale, string>> = {
  'en-US': 'https://tally.so/r/Eqlzvr',
  'es-419': 'https://tally.so/r/Eqlzvr',
};

export function translationFeedbackUrl(locale: TranslationLocale): string | undefined {
  const value = translationFeedbackUrls[locale]?.trim();
  if (!value) return undefined;
  try { return new URL(value).protocol === 'https:' ? value : undefined; }
  catch { return undefined; }
}
