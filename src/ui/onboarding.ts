// Tela de primeiro uso (LAT-21): o caminho até o currículo aberto em três
// passos, que se marcam sozinhos conforme a extensão responde. Ver
// docs/fluxos_de_uso.md. Aqui ficam as regras; a tela está em Welcome.tsx.
//
// O app sabe da extensão pelo aperto de mão: sem resposta, não dá para
// distinguir extensão ausente de navegador fechado, e o texto cobre os dois.

import type { Link } from '../bridge/link.ts';
import { isDevVersion } from '../desktop/dev-channel.ts';
import type { OpenState } from './lattes-open.ts';
import { failureText } from './lattes-open.ts';
import { devExtensionHowTo, EXTENSION_URL } from './notifications.ts';

/**
 * O menu do currículo no Lattes. Com sessão, abre o currículo de quem está
 * logado; sem sessão, o Lattes leva ao login (o redirecionamento é inferido).
 */
export const LATTES_URL = 'https://wwws.cnpq.br/cvlattesweb/PKG_MENU.menu';

export type StepStatus = 'agora' | 'depois' | 'feito';

export interface Step {
  /**
   * O que fazer agora: abrir um endereço fora do app, pedir o currículo de
   * novo, recarregar a aba do Lattes (sessão vencida) ou, com o Exportar
   * bloqueado, abrir a última versão que o app guardou.
   */
  action?: { href?: string; kind: 'link' | 'recarregar' | 'tentar' | 'versao'; label: string };
  /** Esperando a extensão ou o Lattes: o passo mostra que está andando. */
  busy?: boolean;
  status: StepStatus;
  text: string;
  title: string;
}

const STEP_TITLES = ['Instale a extensão', 'Entre no Lattes', 'Seu currículo abre aqui'] as const;

function extensionStep(link: Link, open: OpenState, devFolder?: string): Step {
  const title = STEP_TITLES[0];
  const { state } = link;
  if (state.kind === 'procurando') {
    return { busy: true, status: 'agora', text: 'Procurando a extensão no navegador…', title };
  }
  // LattesEditor Dev: a extensão Dev vem no pacote do app e se carrega de uma pasta.
  if (state.kind === 'sem-extensao' && isDevVersion(__APP_VERSION__)) {
    return {
      status: 'agora',
      text: devExtensionHowTo(devFolder),
      title: 'Carregue a extensão Dev',
    };
  }
  const download = { href: EXTENSION_URL, kind: 'link' as const, label: 'Baixar a extensão' };
  if (state.kind === 'sem-extensao') {
    return {
      action: download,
      status: 'agora',
      text: 'Instale a extensão do LattesEditor no Chrome ou no Brave. Se já instalou, abra o navegador.',
      title,
    };
  }
  if (state.kind === 'incompativel' || !link.features?.includes('curriculo')) {
    return {
      action: { ...download, label: 'Baixar a versão nova' },
      status: 'agora',
      text: 'A extensão instalada é de uma versão anterior e não abre o currículo. Atualize a extensão.',
      title: 'Atualize a extensão',
    };
  }
  const noConsent =
    (state.kind === 'sem-leitura' && state.reason === 'consentimento') ||
    (open.kind === 'falhou' && open.reason === 'consentimento');
  if (noConsent) {
    return {
      status: 'agora',
      text: 'Abra o painel da extensão, no ícone dela no navegador, e aceite o aviso de uso.',
      title: 'Aceite o aviso da extensão',
    };
  }
  return { status: 'feito', text: 'Extensão ligada.', title };
}

function lattesStep(link: Link, open: OpenState): Step {
  const title = STEP_TITLES[1];
  // Uma leitura do menu chegou: na tela inicial ainda não há currículo, então
  // qualquer sessão conta (outro-cv é só "não é o currículo aberto").
  if (link.state.kind === 'lido' || link.state.kind === 'outro-cv') {
    return { status: 'feito', text: 'Lattes aberto.', title };
  }
  const dropped = open.kind === 'falhou' && open.reason === 'sessao';
  // Extensão acabou de responder; a leitura do menu vem logo atrás.
  if (link.state.kind === 'lendo' && !dropped) {
    return { busy: true, status: 'agora', text: 'Procurando o Lattes aberto no navegador…', title };
  }
  if (dropped) {
    return {
      action: reloadAction(link),
      status: 'agora',
      text: 'A sessão do Lattes expirou.',
      title,
    };
  }
  return {
    action: { href: LATTES_URL, kind: 'link', label: 'Abrir o Lattes' },
    status: 'agora',
    text: 'No navegador com a extensão, entre no Lattes e deixe o menu do currículo aberto numa aba.',
    title,
  };
}

/**
 * Sessão vencida: a aba ainda mostra o currículo, então o que resolve é
 * recarregá-la (o Lattes leva ao login). Extensão de antes dessa capacidade:
 * o link para o Lattes.
 */
function reloadAction(link: Link): NonNullable<Step['action']> {
  return link.features?.includes('recarregar-lattes')
    ? { kind: 'recarregar', label: 'Recarregar o Lattes' }
    : { href: LATTES_URL, kind: 'link', label: 'Abrir o Lattes' };
}

/**
 * A última versão deste currículo que o app guardou (a linha do tempo de
 * versões, LAT-12): uma exportação, logo uma versão publicada.
 */
export interface StoredVersion {
  /** DD/MM/AAAA da exportação. */
  date: string;
  id: number;
}

function openStep(open: OpenState, link: Link, stored?: StoredVersion): Step {
  const title = STEP_TITLES[2];
  const retry = { kind: 'tentar' as const, label: 'Tentar de novo' };
  switch (open.kind) {
    case 'abrindo':
      return { busy: true, status: 'agora', text: 'Trazendo o currículo do Lattes…', title };
    case 'falhou':
      // Com o Exportar bloqueado por pendência, o app não para: abre a última
      // versão publicada que tem e compara com a página de conferência do
      // Lattes (docs/fluxos_de_uso.md, "Quem volta ao Lattes depois de anos").
      if (open.reason === 'pendente' && stored) {
        return {
          action: { kind: 'versao', label: `Abrir a versão de ${stored.date}` },
          status: 'agora',
          text: `O seu Lattes tem alterações ainda não enviadas ao CNPq e só exporta depois do envio. Abra a versão publicada de ${stored.date}, guardada no app; o diagnóstico mostra o que mudou no Lattes desde então.`,
          title,
        };
      }
      return {
        action: open.reason === 'sessao' ? reloadAction(link) : retry,
        status: 'agora',
        text: failureText(open.reason, open.detail),
        title,
      };
    case 'parado':
      return {
        action: { kind: 'tentar', label: 'Abrir do Lattes' },
        status: 'agora',
        text: 'A extensão traz o currículo da sessão aberta no Lattes.',
        title,
      };
  }
}

const waiting = (title: string, text: string): Step => ({ status: 'depois', text, title });

/** Os três passos, cada um no seu estado; um passo só começa quando o anterior está feito. */
export function onboardingSteps(
  link: Link,
  open: OpenState,
  devFolder?: string,
  stored?: StoredVersion,
): Step[] {
  const extension = extensionStep(link, open, devFolder);
  if (extension.status !== 'feito') {
    return [
      extension,
      waiting(STEP_TITLES[1], 'No navegador com a extensão.'),
      waiting(STEP_TITLES[2], 'Sem baixar nem escolher arquivo.'),
    ];
  }
  const lattes = lattesStep(link, open);
  if (lattes.status !== 'feito') {
    return [extension, lattes, waiting(STEP_TITLES[2], 'Sem baixar nem escolher arquivo.')];
  }
  return [extension, lattes, openStep(open, link, stored)];
}
