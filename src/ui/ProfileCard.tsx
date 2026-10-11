// Quem é o currículo, no topo do menu lateral, como no cabeçalho do currículo
// no Lattes: iniciais, nome, endereço público do CV e a data do arquivo.
//
// A foto não vem na exportação (só o nome do arquivo dela). Buscá-la no CNPq
// mandaria o identificador para fora da máquina, então ficam as iniciais.

import { CopyButton } from './CopyButton.tsx';
import { formatLattesDate } from './format.ts';
import { initials, type Profile } from './profile.ts';

export function ProfileCard({ profile }: { profile: Profile }) {
  const date = formatLattesDate(profile.date);
  const url = profile.lattesId ? `https://lattes.cnpq.br/${profile.lattesId}` : undefined;
  return (
    <section
      aria-label="Currículo aberto"
      className="profile"
      title={`Arquivo: ${profile.fileName}`}
    >
      <div aria-hidden="true" className="avatar">
        {initials(profile.name)}
      </div>
      <div className="profile-text">
        <strong className="profile-name">{profile.name}</strong>
        {url && (
          <span className="field-copy-row profile-line">
            <a href={url} rel="noreferrer" target="_blank">
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
      </div>
    </section>
  );
}
