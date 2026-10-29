import { Link } from 'react-router-dom';
import { ThemeToggle } from './ThemeToggle';

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="site-header__inner">
        <Link to="/" className="site-header__brand" aria-label="Custode — início">
          <img src="/custode-trevo.svg" width="400" height="510" alt="Trevo verde de quatro folhas da Custode" />
        </Link>
        <div className="site-header__actions">
          <Link className="site-header__link" to="/">Índice de capítulos</Link>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
