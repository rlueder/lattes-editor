// O texto do aviso de atualização para cada estado (src/desktop/update.ts).

import type { CheckOutcome, UpdateState } from '../desktop/update.ts';

export interface UpdateToastText {
  /** O botão: "atualizar" instala; "baixar" abre a página de lançamentos. */
  action?: 'atualizar' | 'baixar';
  description: string;
  title: string;
}

/**
 * O que identifica um aviso para quem o fecha: o estado e a versão, sem o
 * percentual. Fechado o "baixando", o progresso não o reabre; um estado novo
 * ("falhou", "reiniciar") sim.
 */
export function updateToastKey(s: UpdateState): string {
  return s.status === 'nenhuma' ? s.status : `${s.status}:${s.version}`;
}

export function updateToastText(s: UpdateState): UpdateToastText | undefined {
  switch (s.status) {
    case 'disponivel':
      return {
        action: 'atualizar',
        description: `Versão ${s.version}. O app reinicia ao atualizar.`,
        title: 'Nova versão disponível',
      };
    case 'baixando':
      return {
        description:
          s.progress === undefined
            ? `Baixando a versão ${s.version}.`
            : `Baixando a versão ${s.version} (${s.progress}%).`,
        title: 'Atualizando…',
      };
    case 'falhou':
      return {
        action: 'baixar',
        description: `Baixe a versão ${s.version} na página de lançamentos.`,
        title: 'Não deu para atualizar',
      };
    case 'reiniciar':
      return {
        description: `A versão ${s.version} já está instalada. Feche e abra o app para usar.`,
        title: 'Atualização instalada',
      };
    case 'nenhuma':
      return undefined;
  }
}

/**
 * O aviso da conferência pedida no menu (⚙). Com versão nova (ou uma já
 * baixando), é o aviso de sempre (updateToastText) e este fica undefined; sem
 * ela, confirma a versão em uso ou diz que a conferência falhou.
 */
export function manualCheckText(
  outcome: CheckOutcome,
  appVersion: string,
): UpdateToastText | undefined {
  if (outcome.state.status !== 'nenhuma') return undefined;
  if (outcome.failed) {
    return {
      description: 'O app tenta de novo sozinho daqui a pouco.',
      title: 'Não deu para verificar agora',
    };
  }
  return {
    description: `Você está na versão mais recente (${appVersion}).`,
    title: 'Nenhuma versão nova',
  };
}
