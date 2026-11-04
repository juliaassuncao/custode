export class InvalidParameters extends Error {}

type Cursor = { v: 1 | 2; order?: 'desc'; chapter: number; created_at: string; id: string };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
// Preserve PostgreSQL microseconds; never round the cursor through Date.toISOString().
const timestamp = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|\+00:00)$/;

function positiveInteger(value: string | null, max: number): number {
  if (!value || !/^[1-9]\d{0,9}$/.test(value)) throw new InvalidParameters();
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number > max) throw new InvalidParameters();
  return number;
}

export function encodeCursor(chapter: number, row: { created_at: string; id: string }, order: 'asc' | 'desc' = 'asc') {
  return btoa(JSON.stringify({ v: order === 'asc' ? 1 : 2, ...(order === 'desc' ? { order } : {}), chapter, created_at: row.created_at, id: row.id }))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function parseReadParameters(url: URL) {
  const params = url.searchParams;
  for (const key of params.keys()) {
    if (!['chapter', 'limit', 'cursor', 'order'].includes(key) || params.getAll(key).length !== 1) {
      throw new InvalidParameters();
    }
  }
  const chapter = positiveInteger(params.get('chapter'), 2147483647);
  const order = params.get('order') ?? 'asc';
  if (order !== 'asc' && order !== 'desc') throw new InvalidParameters();
  const limit = params.has('limit') ? positiveInteger(params.get('limit'), 50) : 20;
  let cursor: Cursor | null = null;
  if (params.has('cursor')) {
    const raw = params.get('cursor')!;
    if (!/^[A-Za-z0-9_-]{1,512}$/.test(raw)) throw new InvalidParameters();
    try {
      const decoded = JSON.parse(atob(raw.replace(/-/g, '+').replace(/_/g, '/')));
      const ascending = decoded?.v === 1 && order === 'asc' && Object.keys(decoded).sort().join(',') === 'chapter,created_at,id,v';
      const descending = decoded?.v === 2 && decoded.order === 'desc' && order === 'desc' && Object.keys(decoded).sort().join(',') === 'chapter,created_at,id,order,v';
      if (!decoded || (!ascending && !descending) || decoded.chapter !== chapter ||
        typeof decoded.id !== 'string' || !uuid.test(decoded.id) ||
        typeof decoded.created_at !== 'string' || !timestamp.test(decoded.created_at) ||
        decoded.created_at.startsWith('0000-') ||
        !Number.isFinite(Date.parse(decoded.created_at)) ||
        new Date(decoded.created_at).toISOString().slice(0, 19) !== decoded.created_at.slice(0, 19)) {
        throw new InvalidParameters();
      }
      cursor = decoded;
    } catch {
      throw new InvalidParameters();
    }
  }
  return { chapter, limit, cursor, order };
}
