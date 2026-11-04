export class WriteError extends Error {
  constructor(public status: number, public code: string, public retryAfter?: number) { super(code); }
}
export type WriteCommand = {
  operation: 'comment' | 'clover' | 'report';
  captcha_token: string;
  input: Record<string, string | number>;
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function parseWrite(value: unknown): WriteCommand {
  const invalid = () => { throw new WriteError(400, 'invalid_parameters'); };
  if (!value || typeof value !== 'object' || Array.isArray(value)) return invalid();
  const data = value as Record<string, unknown>;
  const operation = data.operation;
  if (!['comment', 'clover', 'report'].includes(String(operation))) return invalid();
  const fields = operation === 'comment' ? ['chapter_number','pseudonym','body','client_request_id'] :
    operation === 'clover' ? ['chapter_number'] : ['comment_id','reason_code','details'];
  if (Object.keys(data).some((key) => !['operation','captcha_token',...fields].includes(key))) return invalid();
  if (typeof data.captcha_token !== 'string' || !data.captcha_token.trim() || data.captcha_token.length > 2048) {
    throw new WriteError(403, 'captcha_failed');
  }
  const input: Record<string, string | number> = {};
  if (operation !== 'report') {
    if (!Number.isInteger(data.chapter_number) || Number(data.chapter_number) < 1 || Number(data.chapter_number) > 2147483647) return invalid();
    input.chapter_number = data.chapter_number as number;
  }
  function text(key: string, min: number, max: number) {
    if (typeof data[key] !== 'string') return invalid();
    const result = (data[key] as string).trim();
    const length = [...result].length; // Match PostgreSQL character counts, including Unicode.
    if (length < min || length > max || result.includes('\0')) return invalid();
    return result;
  }
  function id(key: string) {
    if (typeof data[key] !== 'string' || !uuid.test(data[key] as string)) return invalid();
    return (data[key] as string).toLowerCase();
  }
  if (operation === 'comment') {
    input.pseudonym = text('pseudonym', 2, 40);
    input.body = text('body', 1, 5000); // Plain text: never interpreted or converted into HTML.
    input.client_request_id = id('client_request_id');
  } else if (operation === 'report') {
    input.comment_id = id('comment_id');
    if (!['spam','harassment','hate_or_discrimination','spoiler','inappropriate_content','other'].includes(String(data.reason_code))) return invalid();
    input.reason_code = data.reason_code as string;
    if (data.details !== undefined) input.details = text('details', 0, 2000);
  }
  return { operation: operation as WriteCommand['operation'], captcha_token: data.captcha_token, input };
}

export async function readWriteBody(request: Request): Promise<unknown> {
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') {
    throw new WriteError(415, 'unsupported_media_type');
  }
  // A streaming byte bound also applies when Content-Length is absent or dishonest.
  const reader = request.body?.getReader();
  if (!reader) throw new WriteError(400, 'invalid_parameters');
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.length;
      if (bytes > 32768) { await reader.cancel(); throw new WriteError(413, 'payload_too_large'); }
      chunks.push(value);
    }
    const body = new Uint8Array(bytes);
    let offset = 0;
    for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.length; }
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(body));
  } catch (error) {
    if (error instanceof WriteError) throw error;
    throw new WriteError(400, 'invalid_parameters');
  } finally { reader.releaseLock(); }
}
