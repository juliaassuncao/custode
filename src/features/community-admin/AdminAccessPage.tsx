import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { adminClient } from './adminClient';
import { completeAdminRecovery, getAdminAccess, requestAdminPassword, signInAdmin, signOutAdmin, updateAdminPassword } from './adminAuth';
import { TurnstileChallenge, type TurnstileChallengeHandle } from '../community/components/TurnstileChallenge';
import './admin-access.scss';
import { AdminDashboard } from './AdminDashboard';

type Access = { state: 'checking' | 'signedOut' | 'authorized' | 'denied'; email?: string; message?: string };
const hasCaptcha = !!import.meta.env.VITE_TURNSTILE_SITE_KEY?.trim() && import.meta.env.VITE_TURNSTILE_SITE_KEY !== 'YOUR_PUBLIC_TURNSTILE_SITE_KEY';

export default function AdminAccessPage() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [access, setAccess] = useState<Access>({ state: 'checking' });
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [captcha, setCaptcha] = useState<string | null>(null);
  const challenge = useRef<TurnstileChallengeHandle>(null);
  const recover = pathname === '/admin/recover';
  const reset = pathname === '/admin/reset';
  const denyDashboardAccess = useCallback((message: string) => setAccess({ state: 'denied', message }), []);
  const showDashboard = access.state === 'authorized' && !reset && !recover;

  useEffect(() => {
    let disposed = false;
    let generation = 0;
    async function refresh() {
      const current = ++generation;
      // Background revalidation must not unmount an already authorized dashboard
      // or reset an unsigned form. The result below still revokes access on failure.
      setAccess(previous => previous.state === 'authorized' || previous.state === 'signedOut' ? previous : { state: 'checking' });
      try {
        await completeAdminRecovery();
        const user = await getAdminAccess();
        if (!disposed && current === generation) setAccess(user ? { state: 'authorized', email: user.email } : { state: 'signedOut' });
      } catch (cause) {
        if (!disposed && current === generation) setAccess({ state: 'denied', message: cause instanceof Error ? cause.message : 'Não foi possível verificar o acesso.' });
      }
    }
    // Do not await Auth operations inside the SDK's locked event callback.
    const subscription = adminClient?.auth.onAuthStateChange(() => {
      queueMicrotask(() => { if (!disposed) void refresh(); });
    }).data.subscription;
    void refresh();
    const onFocus = () => { void refresh(); };
    window.addEventListener('focus', onFocus);
    const timer = window.setInterval(onFocus, 60000);
    return () => { disposed = true; generation++; subscription?.unsubscribe(); window.removeEventListener('focus', onFocus); clearInterval(timer); };
  }, [revision, pathname]);

  useEffect(() => { setError(''); setNotice(''); setCaptcha(null); }, [pathname]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = new FormData(form);
    const password = String(fields.get('password') ?? '');
    if (reset && password !== fields.get('confirmation')) { setError('As senhas precisam ser iguais.'); return; }
    setBusy(true); setError(''); setNotice('');
    try {
      if (recover) {
        await requestAdminPassword(String(fields.get('email')), captcha);
        setNotice('Se houver uma conta apta à recuperação para este e-mail, você receberá um link. Abra-o neste mesmo navegador.');
      } else if (reset) {
        await updateAdminPassword(password);
        navigate('/admin/login', { replace: true });
      } else {
        await signInAdmin(String(fields.get('email')), password, captcha);
        setRevision(value => value + 1);
      }
      form.reset();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível concluir. Tente novamente.'); }
    finally { setBusy(false); setCaptcha(null); challenge.current?.reset(); }
  }

  async function logout() {
    setBusy(true); setError('');
    // Remove private content immediately, even if revocation fails.
    setAccess({ state: 'denied', message: 'Encerrando sessão…' });
    try { await signOutAdmin(); navigate('/admin/login', { replace: true }); setRevision(value => value + 1); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível sair.'); }
    finally { setBusy(false); }
  }

  if (!['/admin', '/admin/', '/admin/login', '/admin/recover', '/admin/reset'].includes(pathname)) return <Navigate to="/admin/login" replace />;
  if ((pathname === '/admin' || pathname === '/admin/') && access.state === 'signedOut') return <Navigate to="/admin/login" replace />;
  if (pathname === '/admin/login' && access.state === 'authorized') return <Navigate to="/admin" replace />;

  return <main className={`admin-access${showDashboard ? ' admin-access--dashboard' : ''}`} aria-labelledby="admin-title">
    <p className="reader__eyebrow">Comunidade Custode</p>
    <h1 id="admin-title">{recover ? 'Recuperar senha' : reset ? 'Definir nova senha' : showDashboard ? 'Painel de moderação' : 'Acesso administrativo'}</h1>
    {error && <p role="alert" className="admin-access__message">{error}</p>}
    {notice && <p role="status" className="admin-access__message">{notice}</p>}
    {access.state === 'checking' ? <p role="status">Verificando sessão e autorização…</p> :
      access.state === 'denied' ? <div>
        <p role="alert">{access.message}</p>
        <div className="admin-access__actions">
          <button className="nav-button" disabled={busy} onClick={() => setRevision(value => value + 1)}>Tentar novamente</button>
          <button className="nav-button" disabled={busy} onClick={() => void logout()}>Sair da conta</button>
          <Link to="/admin/recover">Solicitar outro link</Link>
        </div>
      </div> : access.state === 'authorized' && !reset && !recover ? <section aria-label="Área privada">
        <div className="admin-dashboard__session">
          <p>Acesso autorizado para {access.email ?? 'sua conta'}.</p>
          <button className="nav-button" disabled={busy} onClick={() => void logout()}>{busy ? 'Saindo…' : 'Sair da conta'}</button>
        </div>
        <AdminDashboard onAccessDenied={denyDashboardAccess} />
      </section> : reset && access.state !== 'authorized' ? <p role="alert">Sua sessão de recuperação não está disponível. <Link to="/admin/recover">Solicite outro link.</Link></p> :
        <form onSubmit={event => void submit(event)} aria-busy={busy}>
          <p>{recover ? 'Informe o e-mail da sua conta administrativa.' : reset ? 'Escolha uma nova senha para sua conta.' : 'Entre com uma conta de moderadora previamente autorizada.'}</p>
          <fieldset disabled={busy}>
            {!reset && <label>E-mail<input name="email" type="email" autoComplete="username" maxLength={254} required /></label>}
            {!recover && <label>{reset ? 'Nova senha' : 'Senha'}<input name="password" type="password" autoComplete={reset ? 'new-password' : 'current-password'} minLength={reset ? 8 : undefined} required /></label>}
            {reset && <label>Confirmar nova senha<input name="confirmation" type="password" autoComplete="new-password" minLength={8} required /></label>}
            {!reset && hasCaptcha && <TurnstileChallenge key={pathname} ref={challenge} onToken={setCaptcha} compact />}
            <button className="primary-link" type="submit" disabled={busy || (!reset && hasCaptcha && !captcha)}>{busy ? 'Aguarde…' : recover ? 'Enviar link de recuperação' : reset ? 'Salvar nova senha' : 'Entrar'}</button>
          </fieldset>
          <div className="admin-access__actions">
            {recover || reset ? <Link to="/admin/login">Voltar ao login</Link> : <Link to="/admin/recover">Esqueci minha senha</Link>}
          </div>
        </form>}
  </main>;
}
