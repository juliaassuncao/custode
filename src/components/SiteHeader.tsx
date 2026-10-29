import { Link } from 'react-router-dom';

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="site-header__inner">
        <Link to="/" className="site-header__brand" aria-label="Custode — início">
          <img src="/custode-trevo.svg" width="400" height="510" alt="Trevo verde de quatro folhas da Custode" />
        </Link>
        <Link className="site-header__link" to="/">Índice de capítulos</Link>
      </div>
    </header>
  );
}
