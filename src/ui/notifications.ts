// Notificações do cabeçalho (o sino ao lado das configurações): o que impede o
// app de ler o Lattes ou de guardar o trabalho, com o que fazer. A faixa de
// estados fica só com o caminho das alterações.

import type { Link } from '../bridge/link.ts';
import type { UpdateState } from '../desktop/update.ts';
import type { StorageStatus } from '../model/store.ts';

/** O que dizer da ligação com o Lattes. */
export type Connection =
  | { kind: 'app-antigo'; version: string }
  | { kind: 'extensao-antiga'; version: string }
  | { kind: 'incompativel' }
  | { kind: 'lendo' }
  | { kind: 'outro-cv' }
  | { kind: 'procurando' }
  | { kind: 'sem-aba' }
  | { kind: 'sem-consentimento' }
  | { kind: 'sem-data' }
  | { kind: 'sem-extensao' }
  | { kind: 'sem-leitura' };

/**
 * O que dizer da ligação. Um lado desatualizado vem primeiro, mesmo com
 * leitura: é ele que explica um recurso que não aparece. Com leitura e
 * versões em dia, nada.
 */
export function connectionOf(link: Link | undefined, read: boolean): Connection | undefined {
  if (!link) return undefined;
  if (link.outdated) {
    return link.outdated.side === 'extensao'
      ? { kind: 'extensao-antiga', version: link.outdated.version }
      : { kind: 'app-antigo', version: link.outdated.version };
  }
  if (read) return undefined;
  const { state } = link;
  switch (state.kind) {
    case 'lido':
      return undefined;
    case 'sem-leitura':
      return state.reason === 'consentimento'
        ? { kind: 'sem-consentimento' }
        : state.reason === 'sem-aba'
          ? { kind: 'sem-aba' }
          : state.reason === 'sem-data'
            ? { kind: 'sem-data' }
            : { kind: 'sem-leitura' };
    default:
      return { kind: state.kind };
  }
}

/** Onde baixar o app: a página do último lançamento. */
export const APP_DOWNLOAD_URL = 'https://github.com/rlueder/lattes-editor/releases/latest';

/**
 * Onde atualizar a extensão. Enquanto ela não tem página na Chrome Web Store
 * (LAT-20), é o zip do último lançamento; com a página publicada, o endereço
 * dela entra aqui.
 */
export const EXTENSION_URL = APP_DOWNLOAD_URL;

export interface NoticeLink {
  href: string;
  label: string;
}

export interface Notice {
  /** Abre o aviso do armazenamento, ou baixa e instala a versão nova do app. */
  action?: 'armazenamento' | 'atualizacao';
  id: string;
  /** "aviso" acende o sino; "info" só aparece ao abrir. */
  level: 'aviso' | 'info';
  /** O que fazer, como link, depois do texto. */
  link?: NoticeLink;
  text: string;
  title: string;
}

/** Estados de passagem, que mudam em segundos: não viram notificação. */
const TRANSIENT = new Set<Connection['kind']>(['lendo', 'procurando']);

const INFO = new Set<Connection['kind']>(['sem-aba', 'sem-data', 'sem-extensao', 'sem-leitura']);

export function connectionTitle(c: Connection): string {
  switch (c.kind) {
    case 'app-antigo':
      return 'App desatualizado';
    case 'extensao-antiga':
      return 'Extensão desatualizada';
    case 'incompativel':
      return 'Extensão incompatível';
    case 'lendo':
      return 'Lendo o Lattes';
    case 'outro-cv':
      return 'Lattes aberto em outro currículo';
    case 'procurando':
      return 'Procurando a extensão';
    case 'sem-aba':
      return 'Lattes fechado';
    case 'sem-consentimento':
      return 'Extensão sem o seu ok';
    case 'sem-data':
      return 'Lattes fora do menu';
    case 'sem-extensao':
      return 'Lattes não conectado';
    case 'sem-leitura':
      return 'Lattes não respondeu';
  }
}

export function connectionText(c: Connection, appVersion: string): string {
  switch (c.kind) {
    case 'app-antigo':
      return `A extensão (v${c.version}) é mais nova do que o editor (v${appVersion}).`;
    case 'extensao-antiga':
      return `A extensão (v${c.version}) é mais antiga do que o editor (v${appVersion}).`;
    case 'incompativel':
      return 'A extensão instalada fala outra versão da ponte e é ignorada.';
    case 'lendo':
      return 'A extensão está lendo o menu do Lattes.';
    case 'outro-cv':
      return 'A sessão do Lattes aberta no navegador é de outro currículo. Entre no Lattes com o currículo deste arquivo.';
    case 'procurando':
      return 'Esperando a extensão do LattesEditor responder.';
    case 'sem-aba':
      return 'Abra o seu currículo no Lattes numa aba do navegador para o cabeçalho mostrar a data da última publicação e o que está pendente.';
    case 'sem-consentimento':
      return 'A extensão só lê o Lattes depois do aviso aceito. Abra o painel da extensão e aceite.';
    case 'sem-data':
      return 'A aba do Lattes não está no menu do currículo, ou a sessão caiu. Volte ao menu (ou entre de novo) para ler a data da última publicação.';
    case 'sem-extensao':
      return 'A extensão do LattesEditor não respondeu. Com ela instalada e o Lattes aberto no navegador, o cabeçalho mostra a data da última publicação e o que está pendente.';
    case 'sem-leitura':
      return 'A extensão não conseguiu ler a aba do Lattes. Recarregue a aba.';
  }
}

/** O que fazer quando a saída é atualizar um dos lados. */
export function connectionLink(c: Connection): NoticeLink | undefined {
  switch (c.kind) {
    case 'app-antigo':
      return { href: APP_DOWNLOAD_URL, label: 'Baixe a versão nova do editor.' };
    case 'extensao-antiga':
      return { href: EXTENSION_URL, label: 'Atualize a extensão no navegador.' };
    case 'incompativel':
      return { href: APP_DOWNLOAD_URL, label: 'Atualize o editor e a extensão.' };
    default:
      return undefined;
  }
}

const STORAGE: Record<Exclude<StorageStatus, 'cifrado'>, Omit<Notice, 'id' | 'level'>> = {
  'chave-perdida': {
    action: 'armazenamento',
    text: 'A chave que cifrava o que o app guardou não está mais no chaveiro do sistema. Abra para ver as opções.',
    title: 'Dados guardados ilegíveis',
  },
  'sem-chave': {
    action: 'armazenamento',
    text: 'O chaveiro do sistema não respondeu: ao fechar o app, o que não foi levado ao Lattes se perde.',
    title: 'Nada está sendo guardado',
  },
};

/** As notificações do momento, as que pedem ação primeiro. */
export function noticesFor({
  appVersion,
  connection,
  storage,
  update,
}: {
  appVersion: string;
  connection?: Connection;
  storage: StorageStatus;
  update?: UpdateState;
}): Notice[] {
  const notices: Notice[] = [];
  // A versão nova fica no sino mesmo com o aviso do canto fechado.
  if (update?.status === 'disponivel') {
    notices.push({
      action: 'atualizacao',
      id: 'atualizacao',
      level: 'aviso',
      text: `Versão ${update.version}. O app reinicia ao atualizar.`,
      title: 'Nova versão disponível',
    });
  }
  if (storage !== 'cifrado') {
    notices.push({ id: 'armazenamento', level: 'aviso', ...STORAGE[storage] });
  }
  if (connection && !TRANSIENT.has(connection.kind)) {
    notices.push({
      id: 'ligacao',
      level: INFO.has(connection.kind) ? 'info' : 'aviso',
      link: connectionLink(connection),
      text: connectionText(connection, appVersion),
      title: connectionTitle(connection),
    });
  }
  return notices;
}
