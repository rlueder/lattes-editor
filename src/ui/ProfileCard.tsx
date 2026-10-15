// Quem é o currículo, no topo do menu lateral, como no cabeçalho do currículo
// no Lattes: foto, nome e a data do arquivo; o endereço público fica em Compartilhar.
//
// A foto vem do CNPq, para ser sempre a mesma do Lattes. O endereço dela pede
// o código de 10 caracteres do currículo, que a exportação não traz. Quem o
// fornece é a extensão (conector), que o lê da sessão do Lattes; sem ela, ficam
// as iniciais. As iniciais ficam por baixo enquanto a foto não chega, e a foto
// que falha é tentada de novo (use-photo.ts). Com a extensão ligada à sessão
// deste currículo, o lápis sobre a foto abre a troca (PhotoDialog.tsx).

import { useEffect, useState } from 'react';

import { formatLattesDate } from './format.ts';
import { PencilIcon } from './icons.tsx';
import { PixelPhoto } from './PixelPhoto.tsx';
import { Tip } from './primitives/Tip.tsx';
import { usePrivacyMode } from './privacy.ts';
import { examplePhotoUrl, initials, photoUrl, type Profile, readCvCode } from './profile.ts';
import { QrCode } from './QrCode.tsx';
import { ShareDialog } from './ShareDialog.tsx';
import { CV_CODE_EVENT } from './use-bridge.ts';
import { usePhoto } from './use-photo.ts';

interface Props {
  /** Muda depois de uma troca de foto, para buscar a nova em vez da guardada. */
  photoVersion?: number;
  profile: Profile;
  /**
   * Abre a troca da foto, com a foto de agora. Sem ela, não há lápis: a
   * extensão não sabe trocar a foto deste currículo agora.
   */
  onChangePhoto?: (current?: string) => void;
}

export function ProfileCard({ onChangePhoto, photoVersion = 0, profile }: Props) {
  const date = formatLattesDate(profile.date);
  const url = profile.lattesId ? `https://lattes.cnpq.br/${profile.lattesId}` : undefined;
  const [code, setCode] = useState(() =>
    profile.lattesId ? readCvCode(profile.lattesId) : undefined,
  );
  // Com a privacidade ligada, a foto vira mosaico.
  const [hidden] = usePrivacyMode();
  const [sharing, setSharing] = useState(false);
  // A extensão do conector entrega o código lido no Lattes.
  useEffect(() => {
    const reload = () => setCode(profile.lattesId ? readCvCode(profile.lattesId) : undefined);
    window.addEventListener(CV_CODE_EVENT, reload);
    return () => window.removeEventListener(CV_CODE_EVENT, reload);
  }, [profile.lattesId]);

  // O currículo de exemplo do dev usa uma foto de mentira; os outros, a do CNPq.
  const base = examplePhotoUrl(profile.lattesId) ?? (code ? photoUrl(code) : undefined);
  const photo = usePhoto(
    base && photoVersion ? `${base}${base.includes('?') ? '&' : '?'}v=${photoVersion}` : base,
  );
  const photoClass = photo.loaded ? 'avatar-photo loaded' : 'avatar-photo';
  return (
    <section aria-label="Currículo aberto" className="profile">
      <div className="profile-top">
        <div className="avatar-wrap">
          <div aria-hidden="true" className="avatar">
            <span className="avatar-initials">{initials(profile.name)}</span>
            {photo.src && hidden ? (
              <PixelPhoto
                className={photoClass}
                src={photo.src}
                onError={photo.onError}
                onLoad={photo.onLoad}
              />
            ) : photo.src ? (
              <img
                alt=""
                className={photoClass}
                src={photo.src}
                onError={photo.onError}
                onLoad={photo.onLoad}
              />
            ) : null}
          </div>
          {onChangePhoto && (
            <Tip label="Trocar a foto no Lattes">
              <button
                aria-label="Trocar a foto no Lattes"
                className="icon-btn avatar-edit"
                type="button"
                onClick={() => onChangePhoto(photo.loaded ? photo.src : undefined)}
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
    </section>
  );
}
