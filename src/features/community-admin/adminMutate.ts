import { adminClient } from './adminClient';
import { AdminAccessError } from './adminAuth';

export type AdminOperation = 'hide_comment' | 'restore_comment' | 'resolve_report' | 'dismiss_report';
export type AdminMutation = Readonly<{
  operation: AdminOperation; target_id: string; expected_version: number; request_id: string; note: string;
}>;
const states: Record<AdminOperation, string> = {
  hide_comment: 'hidden', restore_comment: 'published', resolve_report: 'resolved', dismiss_report: 'dismissed',
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export class AdminMutationError extends Error {
  constructor(message: string, public readonly code: string, public readonly uncertain = false) { super(message); }
}

export function createAdminMutation(operation: AdminOperation, target: string, version: number, note: string): AdminMutation {
  const normalized = note.trim();
  if (!Object.prototype.hasOwnProperty.call(states, operation) || !uuid.test(target) ||
    !Number.isInteger(version) || version < 0 || version > 2147483646) throw new Error('O registro precisa ser atualizado antes desta ação.');
  if (operation === 'hide_comment' && !normalized) throw new Error('Informe um motivo para ocultar o comentário.');
  if ([...normalized].length > 2000 || normalized.includes('\0')) throw new Error('Use até 2.000 caracteres válidos na observação.');
  return Object.freeze({ operation, target_id: target.toLowerCase(), expected_version: version, request_id: crypto.randomUUID(), note: normalized });
}

const inFlight = new Map<string, Promise<void>>();
export function adminMutate(command: AdminMutation): Promise<void> {
  const existing = inFlight.get(command.request_id);
  if (existing) return existing;
  const request = send(command).finally(() => inFlight.delete(command.request_id));
  inFlight.set(command.request_id, request);
  return request;
}

async function send(command: AdminMutation): Promise<void> {
  try {
    if (!adminClient) throw new AdminAccessError('O acesso administrativo não está configurado.', 'unavailable');
    const { data, error } = await adminClient.auth.getSession();
    if (error || !data.session) throw new AdminAccessError('Sua sessão expirou. Entre novamente.', 'unauthorized');
    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/community-admin`, {
      method: 'POST', headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY!,
        Authorization: `Bearer ${data.session.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(command), signal: AbortSignal.timeout(25000),
    });
    if (response.status === 401) throw new AdminAccessError('Sua sessão expirou. Entre novamente.', 'unauthorized');
    if (response.status === 403) throw new AdminAccessError('Esta conta não tem autorização administrativa ativa.', 'forbidden');
    if (response.status === 409) {
      const result = await response.json();
      const idempotency = result.error?.code === 'idempotency_conflict';
      throw new AdminMutationError(idempotency ? 'Este envio entrou em conflito com outra requisição. Atualize a listagem antes de uma nova ação.' :
        'O registro foi alterado por outra ação. Atualize a listagem antes de tentar novamente.', idempotency ? 'idempotency_conflict' : 'state_conflict');
    }
    if (response.status === 404) throw new AdminMutationError('O registro não está mais disponível. Atualize a listagem.', 'not_found');
    if ([400, 413, 415].includes(response.status)) throw new AdminMutationError('O envio foi rejeitado. Confira a observação e tente novamente.', 'invalid_parameters');
    if (!response.ok) throw new Error('Uncertain result');
    const result = await response.json();
    if (!uuid.test(result.audit_id) || result.target_id !== command.target_id || typeof result.replayed !== 'boolean' ||
      result.state?.status !== states[command.operation] || result.state?.version !== command.expected_version + 1) throw new Error('Invalid mutation response');
    // A replay describes the original success. Always read the current record again.
  } catch (error) {
    if (error instanceof AdminAccessError || error instanceof AdminMutationError) throw error;
    throw new AdminMutationError('Não foi possível confirmar o resultado. Repita o envio com os mesmos dados para verificar a operação.', 'uncertain', true);
  }
}
