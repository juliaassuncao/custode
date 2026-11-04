import { adminClient } from './adminClient';
import { AdminAccessError } from './adminAuth';

export type AdminResource = 'comments' | 'reports' | 'history';
export type CommentStatus = 'published' | 'hidden' | 'removed';
export type ReportStatus = 'open' | 'resolved' | 'dismissed';
export type AdminComment = {
  id: string; chapter_number: number; pseudonym: string; body: string;
  status: CommentStatus; moderation_version: number; created_at: string; moderated_at: string | null; moderation_reason: string | null;
};
export type AdminReport = {
  id: string; reason_code: string; details: string | null; status: ReportStatus; moderation_version: number;
  created_at: string; resolved_at: string | null; resolution_note: string | null;
  comment: Pick<AdminComment, 'chapter_number' | 'pseudonym' | 'body' | 'status'>;
};
export type AdminHistory = {
  id: string; action: string; reason: string | null; created_at: string;
  before: string | null; after: string | null;
};
export type AdminItems = { comments: AdminComment; reports: AdminReport; history: AdminHistory };
export type AdminPage<R extends AdminResource> = { items: AdminItems[R][]; next_cursor: string | null };
export type AdminQuery = { resource: AdminResource; chapter: string; status: string; cursor: string | null };

export const commentStates: Record<CommentStatus, string> = { published: 'Publicado', hidden: 'Oculto', removed: 'Removido' };
export const reportStates: Record<ReportStatus, string> = { open: 'Aberta', resolved: 'Resolvida', dismissed: 'Descartada' };

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid record');
  return value as Record<string, unknown>;
}
function text(value: unknown): string {
  if (typeof value !== 'string') throw new Error('Invalid text');
  return value;
}
function nullable(value: unknown): string | null { return value === null ? null : text(value); }
function date(value: unknown): string {
  const result = text(value);
  if (!Number.isFinite(Date.parse(result))) throw new Error('Invalid date');
  return result;
}
function nullableDate(value: unknown): string | null { return value === null ? null : date(value); }
function state<T extends string>(value: unknown, options: Record<T, string>): T {
  if (typeof value !== 'string' || !Object.prototype.hasOwnProperty.call(options, value)) throw new Error('Invalid state');
  return value as T;
}
function comment(value: unknown) {
  const row = record(value);
  if (!Number.isInteger(row.chapter_number) || Number(row.chapter_number) < 1) throw new Error('Invalid chapter');
  return { chapter_number: Number(row.chapter_number), pseudonym: text(row.pseudonym), body: text(row.body), status: state(row.status, commentStates) };
}
function version(value: unknown): number {
  if (!Number.isInteger(value) || Number(value) < 0 || Number(value) > 2147483647) throw new Error('Invalid moderation version');
  return Number(value);
}

// Explicit projections keep unknown fields and reader identities out of UI data.
function project(resource: AdminResource, value: unknown): AdminItems[AdminResource] {
  const row = record(value);
  const base = { id: text(row.id), created_at: date(row.created_at) };
  if (resource === 'comments') return { ...base, ...comment(row), moderation_version: version(row.moderation_version), moderated_at: nullableDate(row.moderated_at), moderation_reason: nullable(row.moderation_reason) };
  if (resource === 'reports') return { ...base, reason_code: text(row.reason_code), details: nullable(row.details),
    status: state(row.status, reportStates), moderation_version: version(row.moderation_version), resolved_at: nullableDate(row.resolved_at), resolution_note: nullable(row.resolution_note), comment: comment(row.comment) };
  const metadata = row.metadata == null ? {} : record(row.metadata);
  const snapshot = (value: unknown) => value == null ? null : nullable(record(value).status ?? null);
  return { ...base, action: text(row.action), reason: nullable(row.reason), before: snapshot(metadata.before), after: snapshot(metadata.after) };
}

export async function adminRead<R extends AdminResource>(query: AdminQuery & { resource: R }, signal: AbortSignal): Promise<AdminPage<R>> {
  try {
    if (!adminClient) throw new AdminAccessError('O acesso administrativo não está configurado.', 'unavailable');
    const { data, error } = await adminClient.auth.getSession();
    if (error || !data.session) throw new AdminAccessError('Sua sessão expirou. Entre novamente.', 'unauthorized');
    const url = new URL(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/community-admin`);
    url.searchParams.set('resource', query.resource);
    url.searchParams.set('limit', '20');
    if (query.chapter) url.searchParams.set('chapter', query.chapter);
    if (query.status && query.resource !== 'history') url.searchParams.set('status', query.status);
    if (query.cursor) url.searchParams.set('cursor', query.cursor);
    const response = await fetch(url, { method: 'GET', headers: {
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY!, Authorization: `Bearer ${data.session.access_token}`,
    }, signal: AbortSignal.any([signal, AbortSignal.timeout(20000)]) });
    if (response.status === 401) throw new AdminAccessError('Sua sessão expirou. Entre novamente.', 'unauthorized');
    if (response.status === 403) throw new AdminAccessError('Esta conta não tem autorização administrativa ativa.', 'forbidden');
    if (!response.ok) throw new Error('Administrative query failed');
    const result = record(await response.json());
    if (!Array.isArray(result.items) || !(result.next_cursor === null || (typeof result.next_cursor === 'string' && result.next_cursor.length > 0))) throw new Error('Invalid page');
    return { items: result.items.map(row => project(query.resource, row)) as AdminItems[R][], next_cursor: result.next_cursor as string | null };
  } catch (error) {
    if (signal.aborted) throw error;
    if (error instanceof AdminAccessError) throw error;
    throw new AdminAccessError('Não foi possível carregar os registros. Tente novamente.', 'unavailable');
  }
}
