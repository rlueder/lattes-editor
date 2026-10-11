// Quem é o currículo, no topo do menu lateral, como no cabeçalho do currículo
// no Lattes: foto, nome e a data do arquivo; o endereço público fica em Compartilhar.
//
// A foto vem do CNPq, para ser sempre a mesma do Lattes. O endereço dela pede
// o código de 10 caracteres do currículo, que a exportação não traz. Quem o
// fornece é a extensão (ponte), que o lê da sessão do Lattes; sem ela, ficam
// as iniciais, e o lápis sobre o avatar deixa colar o endereço da página uma vez.

import { useEffect, useId, useState } from 'react';

import { formatLattesDate } from './format.ts';
import { PencilIcon } from './icons.tsx';
import { Modal } from './Modal.tsx';
import { PixelPhoto } from './PixelPhoto.tsx';
import { Tip } from './primitives/Tip.tsx';
import { usePrivacyMode } from './privacy.ts';
import {
  initials,
  parseCvCode,
  photoUrl,
  type Profile,
  readCvCode,
  writeCvCode,
} from './profile.ts';
import { QrCode } from './QrCode.tsx';
import { ShareDialog } from './ShareDialog.tsx';
import { CV_CODE_EVENT } from './use-bridge.ts';

export function ProfileCard({ profile }: { profile: Profile }) {
  const date = formatLattesDate(profile.date);
  const url = profile.lattesId ? `https://lattes.cnpq.br/${profile.lattesId}` : undefined;
  const [code, setCode] = useState(() =>
    profile.lattesId ? readCvCode(profile.lattesId) : undefined,
  );
  const [failed, setFailed] = useState(false);
  // Com a privacidade ligada, a foto vira mosaico.
  const [hidden] = usePrivacyMode();
  const [asking, setAsking] = useState(false);
  const [sharing, setSharing] = useState(false);
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
      <div className="profile-top">
        <div className="avatar-wrap">
          <div aria-hidden="true" className="avatar">
            {showPhoto && hidden ? (
              <PixelPhoto src={photoUrl(code)} />
            ) : showPhoto ? (
              <img alt="" src={photoUrl(code)} onError={() => setFailed(true)} />
            ) : (
              initials(profile.name)
            )}
          </div>
          {url && (
            <Tip label="Foto do perfil">
              <button
                aria-label="Editar a foto do perfil"
                className="avatar-edit"
                type="button"
                onClick={() => setAsking(true)}
              >
                <PencilIcon />
              </button>
            </Tip>
          )}
        </div>
        {url && (
          <Tip label="Compartilhar o currículo">
            <button
              aria-label="Compartilhar o currículo"
              className="profile-qr"
              type="button"
              onClick={() => setSharing(true)}
            >
              <QrCode label="" text={url} />
            </button>
          </Tip>
        )}
      </div>
      <div className="profile-text">
        <strong className="profile-name">{profile.name}</strong>
        {date && (
          <Tip label="Data registrada no arquivo exportado do Lattes">
            <span className="profile-line muted">Arquivo de {date}</span>
          </Tip>
        )}
      </div>
      {url && <ShareDialog open={sharing} url={url} onClose={() => setSharing(false)} />}
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
