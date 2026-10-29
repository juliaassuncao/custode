import { Link } from 'react-router-dom';

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="site-header__inner">
        <Link to="/" className="site-header__brand" aria-label="Custode — início">
          <img src="/trevo.png" width="42" height="42" alt="" />
          <span>CUSTODE</span>
        </Link>
        <Link className="site-header__link" to="/">Índice de capítulos</Link>
      </div>
    </header>
  );
}
