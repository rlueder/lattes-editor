// Quem é o currículo, no topo do menu lateral, como no cabeçalho do currículo
// no Lattes: foto, nome e a data do arquivo; o endereço público fica em Compartilhar.
//
// A foto vem do CNPq, para ser sempre a mesma do Lattes. O endereço dela pede
// o código de 10 caracteres do currículo, que a exportação não traz. Quem o
// fornece é a extensão (conector), que o lê da sessão do Lattes; sem ela, ficam
// as iniciais. O editor não troca a foto no Lattes, então não há o que editar
// aqui.

import { useEffect, useState } from 'react';

import { formatLattesDate } from './format.ts';
import { PixelPhoto } from './PixelPhoto.tsx';
import { Tip } from './primitives/Tip.tsx';
import { usePrivacyMode } from './privacy.ts';
import { examplePhotoUrl, initials, photoUrl, type Profile, readCvCode } from './profile.ts';
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
  const [sharing, setSharing] = useState(false);
  useEffect(() => setFailed(false), [code]);
  // A extensão do conector entrega o código lido no Lattes.
  useEffect(() => {
    const reload = () => setCode(profile.lattesId ? readCvCode(profile.lattesId) : undefined);
    window.addEventListener(CV_CODE_EVENT, reload);
    return () => window.removeEventListener(CV_CODE_EVENT, reload);
  }, [profile.lattesId]);

  // O currículo de exemplo do dev usa uma foto de mentira; os outros, a do CNPq.
  const src = examplePhotoUrl(profile.lattesId) ?? (code ? photoUrl(code) : undefined);
  const showPhoto = src && !failed;
  return (
    <section aria-label="Currículo aberto" className="profile">
      <div className="profile-top">
        <div className="avatar-wrap">
          <div aria-hidden="true" className="avatar">
            {showPhoto && hidden ? (
              <PixelPhoto src={src} />
            ) : showPhoto ? (
              <img alt="" src={src} onError={() => setFailed(true)} />
            ) : (
              initials(profile.name)
            )}
          </div>
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
