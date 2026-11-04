import type { Mutation } from './communityWrite';
export type CommentDraft = Extract<Mutation, { operation: 'comment' }>;
const key = (chapter: number) => `custode-community-comment-${chapter}`;

export function commentValidation(pseudonym: string, body: string): string | null {
  const nameLength = [...pseudonym.trim()].length;
  const bodyLength = [...body.trim()].length;
  if (nameLength < 2 || nameLength > 40) return 'Use um pseudônimo de 2 a 40 caracteres.';
  if (bodyLength < 1 || bodyLength > 5000) return 'Escreva um comentário de 1 a 5.000 caracteres.';
  if (pseudonym.includes('\0') || body.includes('\0')) return 'Remova os caracteres inválidos do texto.';
  return null;
}
export function restoreComment(chapter: number): CommentDraft | null {
  try {
    const draft = JSON.parse(sessionStorage.getItem(key(chapter)) ?? 'null');
    if (draft?.operation !== 'comment' || draft.chapter_number !== chapter ||
      typeof draft.pseudonym !== 'string' || typeof draft.body !== 'string' ||
      typeof draft.client_request_id !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(draft.client_request_id) ||
      commentValidation(draft.pseudonym, draft.body)) return null;
    return draft;
  } catch { return null; }
}
export function preserveComment(draft: CommentDraft) {
  // Not a source of server state: only the exact payload/UUID for uncertain retries.
  // A blocked storage write stops submission instead of risking a lost retry key.
  try { sessionStorage.setItem(key(draft.chapter_number), JSON.stringify(draft)); }
  catch { throw new Error('Permita o armazenamento desta aba para preservar seu comentário em caso de falha.'); }
}
export function clearComment(chapter: number) {
  try { sessionStorage.removeItem(key(chapter)); } catch { /* A future retry remains idempotent. */ }
}
