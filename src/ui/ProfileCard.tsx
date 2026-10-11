// Quem é o currículo, no topo do menu lateral, como no cabeçalho do currículo
// no Lattes: foto, nome, endereço público do CV e a data do arquivo.
//
// A foto vem do CNPq, para ser sempre a mesma do Lattes. O endereço dela pede
// o código de 10 caracteres do currículo, que a exportação não traz. Quem o
// fornece é a extensão (ponte), que o lê da sessão do Lattes; sem ela, ficam
// as iniciais, e um link discreto deixa colar o endereço da página uma vez.

import { useEffect, useId, useState } from 'react';

import { CopyButton } from './CopyButton.tsx';
import { formatLattesDate } from './format.ts';
import { Modal } from './Modal.tsx';
import {
  initials,
  parseCvCode,
  photoUrl,
  type Profile,
  readCvCode,
  writeCvCode,
} from './profile.ts';

export function ProfileCard({ profile }: { profile: Profile }) {
  const date = formatLattesDate(profile.date);
  const url = profile.lattesId ? `https://lattes.cnpq.br/${profile.lattesId}` : undefined;
  const [code, setCode] = useState(() =>
    profile.lattesId ? readCvCode(profile.lattesId) : undefined,
  );
  const [failed, setFailed] = useState(false);
  const [asking, setAsking] = useState(false);
  useEffect(() => setFailed(false), [code]);

  const save = (next: string | undefined) => {
    if (profile.lattesId) writeCvCode(profile.lattesId, next);
    setCode(next);
    setAsking(false);
  };

  const showPhoto = code && !failed;
  return (
    <section
      aria-label="Currículo aberto"
      className="profile"
      title={`Arquivo: ${profile.fileName}`}
    >
      <div aria-hidden="true" className="avatar">
        {showPhoto ? (
          <img alt="" src={photoUrl(code)} onError={() => setFailed(true)} />
        ) : (
          initials(profile.name)
        )}
      </div>
      <div className="profile-text">
        <strong className="profile-name">{profile.name}</strong>
        {url && (
          <span className="field-copy-row profile-line">
            <a href={url} rel="noreferrer" target="_blank" title={url}>
              lattes.cnpq.br/{profile.lattesId}
            </a>
            <CopyButton label="endereço do currículo" value={url} />
          </span>
        )}
        {date && (
          <span className="profile-line muted" title="DATA-ATUALIZACAO do arquivo exportado">
            Arquivo de {date}
          </span>
        )}
        {url && !showPhoto && (
          <button
            className="link-btn profile-photo-link"
            type="button"
            onClick={() => setAsking(true)}
          >
            Usar a foto do Lattes
          </button>
        )}
      </div>
      {url && (
        <PhotoDialog
          current={code}
          cvUrl={url}
          open={asking}
          onClose={() => setAsking(false)}
          onSave={save}
        />
      )}
    </section>
  );
}

function PhotoDialog({
  current,
  cvUrl,
  onClose,
  onSave,
  open,
}: {
  current?: string;
  cvUrl: string;
  open: boolean;
  onClose: () => void;
  onSave: (code: string | undefined) => void;
}) {
  const [text, setText] = useState('');
  const id = useId();
  const code = parseCvCode(text);
  return (
    <Modal
      focusFirstField
      className="photo-dialog"
      footer={
        <>
          {current && (
            <button className="ghost danger" type="button" onClick={() => onSave(undefined)}>
              Usar as iniciais
            </button>
          )}
          <button
            className="primary"
            disabled={!code}
            type="button"
            onClick={() => {
              onSave(code);
              setText('');
            }}
          >
            Mostrar a foto
          </button>
        </>
      }
      label="Foto do Lattes"
      open={open}
      title="Foto do Lattes"
      onClose={onClose}
    >
      <p>
        A foto vem do CNPq, para ser a mesma do Lattes. Para buscá-la, o editor precisa do código do
        currículo, que não vem no arquivo exportado.
      </p>
      <ol className="photo-steps">
        <li>
          Abra{' '}
          <a href={cvUrl} rel="noreferrer" target="_blank">
            o seu currículo no Lattes
          </a>
          .
        </li>
        <li>
          Copie o endereço da página aberta. Ele termina em <code>id=</code> seguido de 10
          caracteres.
        </li>
        <li>Cole aqui.</li>
      </ol>
      <div className="field">
        <label htmlFor={id}>Endereço da página ou código</label>
        <input
          id={id}
          placeholder="buscatextual.cnpq.br/…visualizacv.do?…id=…"
          spellCheck={false}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        {text && !code && (
          <span className="field-error">Não achei o código de 10 caracteres nesse texto.</span>
        )}
      </div>
    </Modal>
  );
}
