import { Component, type ReactNode } from 'react';
export class CommunityBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) return <aside className="reader__status" aria-label="Comunidade">
      <p role="status">A comunidade está indisponível por enquanto.</p>
      <button className="nav-button" type="button" onClick={() => this.setState({ failed: false })}>Tentar novamente</button>
    </aside>;
    return this.props.children;
  }
}
