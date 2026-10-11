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
import { PixelPhoto } from './PixelPhoto.tsx';
import { Tip } from './primitives/Tip.tsx';
import { PRIVACY_EVENT, readHideSensitive } from './privacy.ts';
import {
  initials,
  parseCvCode,
  photoUrl,
  type Profile,
  readCvCode,
  writeCvCode,
} from './profile.ts';
import { CV_CODE_EVENT } from './use-bridge.ts';

export function ProfileCard({ profile }: { profile: Profile }) {
  const date = formatLattesDate(profile.date);
  const url = profile.lattesId ? `https://lattes.cnpq.br/${profile.lattesId}` : undefined;
  const [code, setCode] = useState(() =>
    profile.lattesId ? readCvCode(profile.lattesId) : undefined,
  );
  const [failed, setFailed] = useState(false);
  // Com a privacidade ligada, a foto vira mosaico.
  const [hidden, setHidden] = useState(readHideSensitive);
  useEffect(() => {
    const onChange = (e: Event) => setHidden((e as CustomEvent<boolean>).detail);
    window.addEventListener(PRIVACY_EVENT, onChange);
    return () => window.removeEventListener(PRIVACY_EVENT, onChange);
  }, []);
  const [asking, setAsking] = useState(false);
  useEffect(() => setFailed(false), [code]);
  // A extensão da ponte entrega o código lido no Lattes.
  useEffect(() => {
    const reload = () => setCode(profile.lattesId ? readCvCode(profile.lattesId) : undefined);
    window.addEventListener(CV_CODE_EVENT, reload);
    return () => window.removeEventListener(CV_CODE_EVENT, reload);
  }, [profile.lattesId]);

  const save = (next: string | undefined) => {
    if (profile.lattesId) writeCvCode(profile.lattesId, next);
    setCode(next);
    setAsking(false);
  };

  const showPhoto = code && !failed;
  return (
    <section aria-label="Currículo aberto" className="profile">
      <div aria-hidden="true" className="avatar">
        {showPhoto && hidden ? (
          <PixelPhoto src={photoUrl(code)} />
        ) : showPhoto ? (
          <img alt="" src={photoUrl(code)} onError={() => setFailed(true)} />
        ) : (
          initials(profile.name)
        )}
      </div>
      <div className="profile-text">
        <strong className="profile-name">{profile.name}</strong>
        {url && (
          <span className="field-copy-row profile-line">
            <Tip label={url}>
              <a href={url} rel="noreferrer" target="_blank">
                lattes.cnpq.br/{profile.lattesId}
              </a>
            </Tip>
            <CopyButton label="endereço do currículo" value={url} />
          </span>
        )}
        {date && (
          <Tip label="Data registrada no arquivo exportado do Lattes">
            <span className="profile-line muted">Arquivo de {date}</span>
          </Tip>
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
