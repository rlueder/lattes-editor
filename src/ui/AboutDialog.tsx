// "Sobre o LattesEditor", no ⚙: o símbolo, a versão, a licença, o código no
// GitHub e quem mantém o projeto, como na página do projeto (site/index.html).

import { BrandSymbol } from './Brand.tsx';
import { Modal } from './Modal.tsx';

const REPO = 'https://github.com/rlueder/lattes-editor';
const SITE = 'https://rlueder.github.io/lattes-editor/';
const PRECISA = 'https://precisa-saude.com.br';

export function AboutDialog({ onClose, open }: { open: boolean; onClose: () => void }) {
  return (
    <Modal
      className="about"
      label="Sobre o LattesEditor"
      open={open}
      title="Sobre o LattesEditor"
      onClose={onClose}
    >
      <div className="about-body">
        <span className="about-symbol">
          <BrandSymbol />
        </span>
        <h2 className="brand about-name">
          Lattes<span className="brand-accent">Editor</span>
        </h2>
        <p className="about-version">Versão {__APP_VERSION__}</p>
        <p>Um editor para o Currículo Lattes, de código aberto e gratuito, com licença MIT.</p>
        <p className="about-links">
          <a href={REPO} rel="noreferrer" target="_blank">
            Código no GitHub
          </a>
          <a href={SITE} rel="noreferrer" target="_blank">
            Página do projeto
          </a>
          <a href={`${REPO}/blob/main/LICENSE`} rel="noreferrer" target="_blank">
            Licença MIT
          </a>
        </p>
        <p className="about-note">
          Mantido pela{' '}
          <a href={PRECISA} rel="noreferrer" target="_blank">
            Precisa Saúde
          </a>
          , sem vínculo com o CNPq ou com a Plataforma Lattes.
        </p>
      </div>
    </Modal>
  );
}
