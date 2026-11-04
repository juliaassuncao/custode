import { useState } from 'react';
import { publicationPath, type Publication } from '../data/publications';
import { CopyLinkIcon, XIcon, FacebookIcon, WhatsAppIcon } from './SharingIcons';

export function PublicationSharing({ publication }: { publication: Publication }) {
  const [status, setStatus] = useState('');
  const url = new URL(publicationPath(publication), window.location.origin).href;
  const encodedUrl = encodeURIComponent(url);
  const title = encodeURIComponent(publication.title);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setStatus('Link copiado.');
    } catch {
      setStatus('Não foi possível copiar o link automaticamente.');
    }
  }

  return (
    <div className="vertice__byline">
      <span className="vertice__publisher">{publication.vehicle}</span>
      <div className="vertice__share" aria-label="Compartilhar reportagem">
        <button type="button" onClick={copyLink} aria-label="Copiar link da reportagem" title="Copiar link">
          <CopyLinkIcon />
        </button>
        <a href={`https://twitter.com/intent/tweet?url=${encodedUrl}&text=${title}`} target="_blank" rel="noopener noreferrer" aria-label="Compartilhar no X"><XIcon /></a>
        <a href={`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`} target="_blank" rel="noopener noreferrer" aria-label="Compartilhar no Facebook"><FacebookIcon /></a>
        <a href={`https://wa.me/?text=${title}%20${encodedUrl}`} target="_blank" rel="noopener noreferrer" aria-label="Compartilhar no WhatsApp"><WhatsAppIcon /></a>
      </div>
      <span className="vertice__copy-status" role="status">{status}</span>
    </div>
  );
}
