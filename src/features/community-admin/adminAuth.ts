import { adminClient } from './adminClient';
import { consumeCaptchaToken } from '../community/services/captchaTokens';

export class AdminAccessError extends Error {
  constructor(message: string, public readonly reason: 'unauthorized' | 'forbidden' | 'unavailable') {
    super(message);
  }
}

function client() {
  if (!adminClient) throw new AdminAccessError('O acesso administrativo não está configurado neste ambiente.', 'unavailable');
  return adminClient;
}

export async function verifyModerator(token: string, request: typeof fetch = fetch): Promise<void> {
  try {
    // The backend validates Auth and active membership. Discard the returned data.
    const response = await request(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/community-admin?resource=comments&limit=1`, {
      headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY!, Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(15000),
    });
    if (response.status === 401) throw new AdminAccessError('Sua sessão expirou. Saia e entre novamente.', 'unauthorized');
    if (response.status === 403) throw new AdminAccessError('Esta conta não tem autorização administrativa ativa.', 'forbidden');
    if (!response.ok) throw new Error('Backend unavailable');
    const result = await response.json();
    if (!Array.isArray(result.items) || !(result.next_cursor === null || typeof result.next_cursor === 'string')) {
      throw new Error('Invalid administrative response');
    }
  } catch (error) {
    if (error instanceof AdminAccessError) throw error;
    throw new AdminAccessError('Não foi possível verificar sua autorização. Tente novamente.', 'unavailable');
  }
}

export async function getAdminAccess() {
  const { data, error } = await client().auth.getSession();
  if (error) throw new AdminAccessError('Não foi possível recuperar sua sessão. Entre novamente.', 'unauthorized');
  if (!data.session) return null;
  if (data.session.user.is_anonymous !== false) {
    throw new AdminAccessError('Esta conta não tem autorização administrativa ativa.', 'forbidden');
  }
  await verifyModerator(data.session.access_token);
  return data.session.user;
}

function captchaOptions(token: string | null) {
  const key = import.meta.env.VITE_TURNSTILE_SITE_KEY?.trim();
  if (key && key !== 'YOUR_PUBLIC_TURNSTILE_SITE_KEY') {
    if (!token || !consumeCaptchaToken(token)) throw new Error('Conclua uma nova verificação de segurança.');
    return { captchaToken: token };
  }
  return {};
}

export async function signInAdmin(email: string, password: string, captcha: string | null) {
  const { error } = await client().auth.signInWithPassword({ email: email.trim(), password, options: captchaOptions(captcha) });
  if (error) {
    if (error.code === 'invalid_credentials') throw new Error('E-mail ou senha incorretos.');
    if (error.code === 'email_not_confirmed') throw new Error('Confirme o e-mail da conta antes de entrar.');
    if (error.code === 'captcha_failed') throw new Error('A verificação de segurança falhou. Tente novamente.');
    if (error.status === 429) throw new Error('Muitas tentativas. Aguarde alguns minutos antes de tentar novamente.');
    throw new Error('Não foi possível entrar. Verifique sua conexão e tente novamente.');
  }
}

export async function signOutAdmin() {
  // Local scope revokes this administrative session, preserving other accounts/devices.
  const { error } = await client().auth.signOut({ scope: 'local' });
  if (error) throw new Error('Não foi possível sair. Tente novamente.');
}

export async function requestAdminPassword(email: string, captcha: string | null) {
  const { error } = await client().auth.resetPasswordForEmail(email.trim(), {
    redirectTo: `${window.location.origin}/admin/reset`, ...captchaOptions(captcha),
  });
  if (error) throw new Error('Não foi possível solicitar a recuperação. Verifique a conexão e a verificação de segurança ou tente mais tarde.');
}

let recovery: Promise<void> | undefined;
export function completeAdminRecovery() {
  if (window.location.pathname !== '/admin/reset') return Promise.resolve();
  // One exchange per page load, including React StrictMode's repeated effects.
  return recovery ??= (async () => {
    const url = new URL(window.location.href);
    const code = url.searchParams.get('code');
    const failed = url.searchParams.has('error') || new URLSearchParams(url.hash.slice(1)).has('error');
    if (code || failed) window.history.replaceState(null, '', '/admin/reset');
    if (!code || failed) throw new Error('Abra um link de recuperação válido no mesmo navegador em que fez a solicitação.');
    const { error } = await client().auth.exchangeCodeForSession(code);
    if (error) throw new Error('O link de recuperação expirou ou já foi utilizado. Solicite outro link.');
  })();
}

export async function updateAdminPassword(password: string) {
  // Revalidate membership immediately before changing a password in this UI.
  if (!await getAdminAccess()) throw new Error('Sua sessão expirou. Solicite outro link de recuperação.');
  const { error } = await client().auth.updateUser({ password });
  if (error) throw new Error('Não foi possível salvar a senha. Use uma senha diferente que atenda à política da conta e tente novamente.');
  await signOutAdmin();
}
