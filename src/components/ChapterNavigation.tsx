import { Link, useNavigate } from 'react-router-dom';
import manifest from '../data/chapters/manifest.json';

interface Props {
  current: number;
  placement?: 'top' | 'bottom';
}

export function ChapterNavigation({ current, placement = 'top' }: Props) {
  const navigate = useNavigate();
  const last = manifest.length;

  return (
    <nav className={`chapter-nav chapter-nav--${placement}`} aria-label={`Navegação de capítulos (${placement})`}>
      <div className="chapter-nav__links">
        {current > 1 ? (
          <Link to={`/capitulo/${current - 1}`} className="nav-button">← Anterior</Link>
        ) : (
          <span className="nav-button nav-button--disabled" aria-disabled="true">← Anterior</span>
        )}
        {current < last ? (
          <Link to={`/capitulo/${current + 1}`} className="nav-button">Próximo →</Link>
        ) : (
          <span className="nav-button nav-button--disabled" aria-disabled="true">Próximo →</span>
        )}
      </div>
      <label className="chapter-nav__select-label">
        <span>Ir para o capítulo</span>
        <select value={current} onChange={(event) => navigate(`/capitulo/${event.target.value}`)}>
          {manifest.map((chapter) => (
            <option key={chapter.number} value={chapter.number}>{chapter.title}</option>
          ))}
        </select>
      </label>
    </nav>
  );
}
