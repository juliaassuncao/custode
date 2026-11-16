export class CommunityRequestError extends Error {
  constructor(message: string, readonly code: string, readonly retryAfter = 0, readonly uncertain = false) {
    super(message);
  }
}

// Render only known, safe messages; never display arbitrary infrastructure responses.
export function responseError(status: number, code: unknown, retry: string | null, context: 'read' | 'write' = 'write') {
  const messages: Record<string, string> = context === 'read' ? {
    unauthorized: 'Sua sessão não pôde ser confirmada. Tente novamente.',
    invalid_parameters: 'Não foi possível carregar a conversa. Tente novamente.',
    chapter_not_found: 'A comunidade deste capítulo está indisponível.',
  } : {
    unauthorized: 'Sua sessão não pôde ser confirmada. Tente novamente.',
    invalid_parameters: 'Confira o pseudônimo, o texto e os campos informados.',
    captcha_failed: 'Conclua uma nova verificação de segurança.',
    chapter_not_found: 'A comunidade deste capítulo está indisponível.',
    comment_not_found: 'Este comentário não está disponível para denúncia.',
    idempotency_conflict: 'Este envio já foi usado com outro conteúdo. Confirme a publicação antes de editar.',
    rate_limited: 'Você chegou ao limite de participações. Aguarde um pouco.',
  };
  const seconds = retry && /^\d{1,6}$/.test(retry) ? Number(retry) : 0;
  const known = typeof code === 'string' && Object.prototype.hasOwnProperty.call(messages, code);
  const fallback = context === 'read' ? 'Não foi possível carregar a conversa. Tente novamente.'
    : 'A comunidade está indisponível no momento. Tente novamente.';
  return new CommunityRequestError(known ? messages[code] : fallback,
    known ? code : 'unavailable', status === 429 ? seconds : 0, status >= 500);
}
