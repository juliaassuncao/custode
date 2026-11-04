import { supabase } from '../../../lib/supabase/client';
import { consumeCaptchaToken } from './captchaTokens';
import type { WriteResults } from '../types';
import { CommunityRequestError, responseError } from './communityErrors';

export type Mutation =
  | { operation: 'comment'; chapter_number: number; pseudonym: string; body: string; client_request_id: string }
  | { operation: 'clover'; chapter_number: number }
  | { operation: 'report'; comment_id: string; reason_code: string; details?: string };

export async function communityWrite<T extends Mutation>(command: T, captchaToken: string): Promise<WriteResults[T['operation']]> {
  if (!supabase) throw new Error('Comunidade indisponível.');
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session) throw new Error('Inicie a sessão antes de participar.');
  // Lifecycle guard only. The Edge Function independently verifies every proof.
  if (!consumeCaptchaToken(captchaToken)) throw new Error('Conclua um novo desafio de segurança.');
  let response: Response;
  try {
    response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/community-write`, {
      method: 'POST', headers: { 'Content-Type': 'application/json',
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY!, Authorization: `Bearer ${data.session.access_token}` },
      body: JSON.stringify({ ...command, captcha_token: captchaToken }), signal: AbortSignal.timeout(25000),
    });
  } catch {
    throw new CommunityRequestError('Não foi possível confirmar o envio. Tente de novo com uma nova verificação.', 'unavailable', 0, true);
  }
  let result;
  try { result = await response.json(); } catch {
    throw new CommunityRequestError('Não foi possível confirmar o envio. Tente de novo com uma nova verificação.', 'unavailable', 0, true);
  }
  if (!response.ok) {
    const retry = response.headers.get('retry-after');
    const failure = responseError(response.status, result.error?.code, retry);
    if (failure.retryAfter) failure.message += ` Tente em ${failure.retryAfter}s.`;
    throw failure;
  }
  if (result.operation !== command.operation ||
    (command.operation === 'comment' && (typeof result.comment_id !== 'string' || typeof result.created_at !== 'string' || typeof result.replayed !== 'boolean')) ||
    (command.operation === 'clover' && (!Number.isSafeInteger(result.clover_count) || result.clover_count < 0 || typeof result.already_left !== 'boolean')) ||
    (command.operation === 'report' && (result.reported !== true || typeof result.already_reported !== 'boolean'))) {
    throw new CommunityRequestError('Não foi possível confirmar o envio. Tente novamente.', 'unavailable', 0, true);
  }
  return result as WriteResults[T['operation']];
}
