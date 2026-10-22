// As escolhas da última vez na janela de envio, guardadas neste navegador por
// currículo, para a próxima abertura começar com elas: idioma principal,
// versão em inglês e os e-mails. A declaração nunca entra aqui: ela é feita
// sob as penas da lei e só vale marcada pela pessoa a cada envio
// (PublishPanel.tsx).

import type { PublishForm } from './publish-view.ts';

const keyOf = (lattesId: string) => `lattes-editor:envio-escolhas:${lattesId}`;

const FIELDS = ['emailAlternative', 'emailContact', 'english', 'language'] as const;

/** O que ficou da última vez; vazio sem currículo, sem armazenamento ou com lixo. */
export function loadChoices(lattesId: string | undefined): Partial<PublishForm> {
  if (!lattesId) return {};
  try {
    const raw = JSON.parse(localStorage.getItem(keyOf(lattesId)) ?? '{}') as Record<
      string,
      unknown
    >;
    const out: Partial<PublishForm> = {};
    for (const f of FIELDS) {
      const v = raw[f];
      if (f === 'english' ? typeof v === 'boolean' : typeof v === 'string') {
        Object.assign(out, { [f]: v });
      }
    }
    return out;
  } catch {
    return {};
  }
}

/** Guarda as escolhas do formulário (só os quatro campos, nunca a declaração). */
export function saveChoices(lattesId: string | undefined, form: PublishForm): void {
  if (!lattesId) return;
  try {
    const kept = Object.fromEntries(FIELDS.map((f) => [f, form[f]]));
    localStorage.setItem(keyOf(lattesId), JSON.stringify(kept));
  } catch {
    // Sem armazenamento, a próxima abertura começa com o que o Lattes tem.
  }
}
