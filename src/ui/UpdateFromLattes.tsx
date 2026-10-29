// "Atualizar do Lattes…": uma entrada só no ⚙, e aqui as duas formas de
// trazer o que mudou no Lattes. Só o que é novo (use-lattes-refresh.ts) lê
// as produções novas ou com outro título e as junta à cópia de trabalho; o
// currículo inteiro (use-lattes-reload.ts) lê tudo de novo e troca a cópia,
// que fica no Histórico.

import { Modal } from './Modal.tsx';

interface Props {
  /** A leitura do currículo inteiro vem pelo Lattes (a extensão), e não de um arquivo escolhido. */
  fromLattes: boolean;
  open: boolean;
  onClose: () => void;
  /** Só o que é novo; ausente sem a extensão que lê os formulários. */
  onNew?: () => void;
  onWhole: () => void;
}

export function UpdateFromLattes({ fromLattes, onClose, onNew, onWhole, open }: Props) {
  const pick = (run: () => void) => () => {
    onClose();
    run();
  };
  return (
    <Modal
      className="update-lattes"
      label="Atualizar do Lattes"
      open={open}
      subtitle="Traga para o editor o que mudou no Lattes desde a última leitura."
      title="Atualizar do Lattes"
      onClose={onClose}
    >
      <div className="update-options">
        <button
          className="update-option"
          disabled={!onNew}
          type="button"
          onClick={onNew && pick(onNew)}
        >
          <span className="update-option-title">Só o que é novo</span>
          <span className="update-option-text">
            {onNew
              ? 'As produções novas ou com outro título. Leva segundos e não mexe no resto da cópia de trabalho.'
              : 'Precisa da extensão do LattesEditor ligada ao Lattes.'}
          </span>
        </button>
        <button className="update-option" type="button" onClick={pick(onWhole)}>
          <span className="update-option-title">O currículo inteiro</span>
          <span className="update-option-text">
            {fromLattes
              ? 'Lê todas as telas do Lattes, o que leva alguns minutos, e troca a cópia de trabalho pelo que veio. A de agora fica no Histórico.'
              : 'Escolha a exportação mais recente (CV_<id>.zip) para trocar a cópia de trabalho pelo que veio. A de agora fica no Histórico.'}
          </span>
        </button>
      </div>
    </Modal>
  );
}
