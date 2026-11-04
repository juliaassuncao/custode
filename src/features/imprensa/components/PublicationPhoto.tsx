import type { Publication } from '../data/publications';

export function PublicationPhoto({ photo }: { photo?: Publication['photo'] }) {
  return (
    <figure className="vertice__figure">
      {photo ? <img src={photo.src} alt={photo.alt} className="vertice__photo" /> : (
        <div className="vertice__photo-placeholder" role="img" aria-label="Espaço reservado para fotografia do Hospital São Peregrino">
          <div className="vertice__hospital">SÃO PEREGRINO<span>HOSPITAL</span></div>
          <span className="vertice__placeholder-label">ESPAÇO RESERVADO · FOTOGRAFIA A DEFINIR</span>
        </div>
      )}
      {photo && (photo.caption || photo.credit) && (
        <figcaption>{photo.caption}{photo.credit && <span>{photo.credit}</span>}</figcaption>
      )}
    </figure>
  );
}
