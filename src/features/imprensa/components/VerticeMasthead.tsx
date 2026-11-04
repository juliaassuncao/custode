import { Link } from 'react-router-dom';

export function VerticeMasthead({ archiveNavigation = false }: { archiveNavigation?: boolean }) {
  return (
    <header className="vertice__masthead">
      <div>
        <Link to="/imprensa" className="vertice__wordmark" aria-label={archiveNavigation ? 'Vértice — arquivo de publicações' : 'Vértice — A Imprensa'}>VÉRTICE</Link>
        <p className="vertice__signature">PODER. PESSOAS. O QUE ESTÁ POR TRÁS.</p>
      </div>
      <nav className="vertice__sections" aria-label="Navegação editorial">
        {archiveNavigation
          ? <Link to="/imprensa#destaques">DESTAQUES</Link>
          : <Link to="/imprensa">A IMPRENSA</Link>}
        <Link to="/imprensa#publicacoes">PUBLICAÇÕES</Link>
      </nav>
    </header>
  );
}
