import { Link, useNavigate } from 'react-router-dom';
import { listedChapters } from '../../../data/chapter28/metadata';

interface Props {
  current: number;
  placement?: 'top' | 'bottom';
}

export function ChapterNavigation({ current, placement = 'top' }: Props) {
  const navigate = useNavigate();
  const last = listedChapters.length;

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
        <select value={listedChapters.some((chapter) => chapter.number === current) ? current : ''} onChange={(event) => navigate(`/capitulo/${event.target.value}`)}>
          {!listedChapters.some((chapter) => chapter.number === current) && <option value="" disabled hidden>Ir para o capítulo</option>}
          {listedChapters.map((chapter) => (
            <option key={chapter.number} value={chapter.number}>{chapter.title}</option>
          ))}
        </select>
      </label>
    </nav>
  );
}
