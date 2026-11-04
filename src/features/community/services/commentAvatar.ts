export function commentAvatar(pseudonym: string) {
  const words = pseudonym.trim().split(/\s+/u).filter(Boolean);
  const initials = (words.length > 1 ? [words[0], words[words.length - 1]].map(word => [...word][0]).join('') : [...(words[0] ?? '?')].slice(0, 2).join('')).toLocaleUpperCase('pt-BR');
  let hash = 0;
  for (const char of pseudonym.normalize('NFC')) hash = (hash * 31 + char.codePointAt(0)!) | 0;
  return { initials, tone: (hash >>> 0) % 3 };
}
