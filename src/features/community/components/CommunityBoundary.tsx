import type { ReaderLocale } from '../../../i18n/locales';
import { readerText } from '../../../i18n/messages';
import { Component, type ReactNode } from 'react';
export class CommunityBoundary extends Component<{ children: ReactNode; locale?: ReaderLocale }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    const t = (message: string) => readerText(this.props.locale ?? 'pt-BR', message);
    if (this.state.failed) return <aside className="reader__status" aria-label={t('Comunidade')}>
      <p role="status">{t('A comunidade está indisponível por enquanto.')}</p>
      <button className="nav-button" type="button" onClick={() => this.setState({ failed: false })}>{t('Tentar novamente')}</button>
    </aside>;
    return this.props.children;
  }
}
