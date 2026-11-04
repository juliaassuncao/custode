import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { AuthorCredit } from '../components/layout/AuthorCredit';
import { portalCreator } from '../data/projectCredits';
import work from '../data/chapters/work.json';
import styles from './ProjectPage.module.scss';

export function ProjectPage() {
  useEffect(() => {
    document.title = 'O projeto · Custode';
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, []);

  return (
    <main className={styles.page}>
      <Link className="reader__back" to="/">← Voltar ao índice</Link>
      <header>
        <p className="reader__eyebrow">CUSTODE · EXPERIÊNCIA DIGITAL</p>
        <h1>O projeto</h1>
        <p>Um espaço de leitura e exploração do universo de Custode, obra de ficção escrita por <AuthorCredit />.</p>
      </header>

      <section aria-labelledby="project-experience">
        <h2 id="project-experience">Uma experiência complementar</h2>
        <p>O portal Custode reúne a leitura da história e conteúdos do seu universo em uma experiência digital própria. O projeto começou como uma alternativa de leitura durante a indisponibilidade do AO3 e oferece uma apresentação complementar à obra.</p>
        <p>É uma iniciativa independente. Sua concepção e seu desenvolvimento digital têm créditos próprios e não constituem uma publicação oficial ou uma edição comercial da autora.</p>
      </section>

      <section aria-labelledby="project-credits">
        <h2 id="project-credits">Autoria e créditos</h2>
        <dl className={styles.credits}>
          <div><dt>Autoria da história</dt><dd><AuthorCredit /></dd></div>
          <div><dt>Concepção e desenvolvimento do portal</dt><dd><AuthorCredit credit={portalCreator} /></dd></div>
        </dl>
        <p>A escrita da história e suas contribuições criativas são de <AuthorCredit />. O crédito pelo desenvolvimento do portal se refere à experiência digital, à organização e à apresentação do site, sem coautoria sobre a narrativa.</p>
        <p><a href={work.ao3Url} target="_blank" rel="noopener noreferrer">Custode no Archive of Our Own ↗</a></p>
      </section>

      <section aria-labelledby="project-rights">
        <h2 id="project-rights">Direitos e utilização do conteúdo</h2>
        <p>O portal reconhece a autoria de <AuthorCredit /> sobre o texto de Custode e suas contribuições criativas. Personagens, universos e outros elementos preexistentes permanecem vinculados aos seus respectivos criadores e titulares de direitos.</p>
        <p>Os créditos acompanham a apresentação da obra e distinguem sua autoria da criação do site. Para pedidos de utilização, adaptação ou redistribuição do texto fora desta experiência, entre em contato com a autora. Autorizações específicas de divulgação e utilização precisam respeitar o que tiver sido acordado com ela e, quando aplicável, com os demais titulares envolvidos.</p>
      </section>
    </main>
  );
}
