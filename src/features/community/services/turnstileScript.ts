export type TurnstileApi = {
  render(container: HTMLElement, options: {
    sitekey: string;
    size?: 'normal' | 'compact';
    callback(token: string): void;
    'expired-callback'(): void;
    'error-callback'(): void;
    'timeout-callback'(): void;
    'response-field': false;
  }): string;
  remove(id: string): void;
};
declare global {
  interface Window { turnstile?: TurnstileApi }
}

let loading: Promise<TurnstileApi> | null = null;

export function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (loading) return loading;
  loading = new Promise<TurnstileApi>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    script.defer = true;
    const timer = setTimeout(() => finish(false), 15000);
    function finish(success: boolean) {
      clearTimeout(timer);
      script.onload = null;
      script.onerror = null;
      if (success && window.turnstile) resolve(window.turnstile);
      else {
        script.remove();
        reject(new Error('Não foi possível carregar a verificação de segurança.'));
      }
    }
    script.onload = () => finish(true);
    script.onerror = () => finish(false);
    document.head.append(script);
  }).catch((error) => { loading = null; throw error; });
  return loading;
}
