// O vigia das listas (LAT-48): as listas que o editor oferece nos campos
// tipados vieram dos combos do Lattes (docs/lattes-listas/). Se o CNPq trocar
// um combo, o editor passaria a oferecer opções que o Lattes não tem mais, ou
// a marcar como fora da lista um valor que agora existe. A conferência do
// contrato (contract.ts) lê, só com GET, um formulário de inclusão que tem
// cada combo, sem salvar nada, e compara as opções com as do editor.
//
// As opções são nomes públicos (países, idiomas, naturezas de evento), então
// podem ir para o relatório que vira issue pública.

import listas from '../schema/listas-lattes.json' with { type: 'json' };
import { EVENT_NATURES } from '../schema/typed-choices.ts';
import { decodeHtmlEntities, foldText } from './html-text.ts';

export interface WatchedList {
  /** Nome do <select> no formulário do Lattes. */
  control: string;
  /** O que o editor oferece. */
  expected: readonly string[];
  label: string;
  /** Formulário de inclusão que tem o combo, sem o código do currículo. */
  path: (code: string) => string;
}

/**
 * Formulários de inclusão com cada combo, lidos no Lattes em 14/10/2026 com as
 * mesmas opções da captura de 13/10/2026 (docs/lattes-listas/). O de eventos
 * pede F_STA_DIVULGACAO_CIENTIFICA, como no link "Novo" da lista de eventos; o
 * nome que a captura registrou para esse parâmetro dá 404.
 */
export const WATCHED_LISTS: WatchedList[] = [
  {
    control: 'f_pais',
    expected: listas.paises,
    label: 'Países',
    path: (code) => `prc_midias_sociais?f_cod=${code}`,
  },
  {
    control: 'F_IDIOMA',
    expected: listas.idiomas,
    label: 'Idiomas',
    path: (code) => `prc_midias_sociais?f_cod=${code}`,
  },
  {
    control: 'F_COD_PROD',
    expected: EVENT_NATURES,
    label: 'Naturezas de evento',
    path: (code) => `PKG_EVENTO.form?f_cod=${code}&F_STA_DIVULGACAO_CIENTIFICA=`,
  },
];

/**
 * O texto das opções de um <select>, sem a opção vazia ("Selecione") nem
 * repetidas; undefined se a página não tem o combo.
 */
export function selectOptions(html: string, control: string): string[] | undefined {
  const name = control.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const select = new RegExp(
    `<select[^>]*\\bname\\s*=\\s*["']?${name}["'\\s>][^>]*>([\\s\\S]*?)</select>`,
    'i',
  ).exec(html);
  if (!select) return undefined;
  const seen = new Set<string>();
  const out: string[] = [];
  for (const m of (select[1] ?? '').matchAll(/<option\b([^>]*)>([^<]*)/gi)) {
    const value = /\bvalue\s*=\s*["']?([^"'\s>]*)/i.exec(m[1] ?? '')?.[1] ?? '';
    const text = decodeHtmlEntities(m[2] ?? '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!value || !text || seen.has(text)) continue;
    seen.add(text);
    out.push(text);
  }
  return out;
}

/** O que o Lattes tem a mais e a menos que o editor (sem diferença de acento e caixa). */
export function compareList(
  expected: readonly string[],
  observed: readonly string[],
): { added: string[]; removed: string[] } {
  const want = new Set(expected.map(foldText));
  const have = new Set(observed.map(foldText));
  return {
    added: observed.filter((o) => !want.has(foldText(o))),
    removed: expected.filter((e) => !have.has(foldText(e))),
  };
}

export type ListStatus = 'erro' | 'mudou' | 'nao-encontrado' | 'ok';

export interface ListCheck {
  /** Opções que o Lattes tem e o editor não. */
  added: string[];
  control: string;
  /** Por que não deu para ler o formulário, quando não deu. */
  detail?: string;
  label: string;
  /** Opções que o editor oferece e o Lattes não tem mais. */
  removed: string[];
  status: ListStatus;
}

interface ListPort {
  get(path: string): Promise<string>;
  /**
   * Se o erro interrompe a conferência inteira (a sessão caiu). Os outros, como
   * falha de rede, marcam só as listas daquele formulário como 'erro'.
   */
  isFatal?(err: unknown): boolean;
}

/** Até tantos nomes por lista no relatório; o resto vira contagem. */
const SHOWN = 5;

/** Uma linha do relatório para uma lista que não está como o editor espera. */
export function listText(check: ListCheck): string {
  if (check.status === 'nao-encontrado') return `${check.label}: combo ${check.control} sumiu`;
  if (check.status === 'erro') {
    return `${check.label}: não deu para ler${check.detail ? ` (${check.detail})` : ''}`;
  }
  const names = (list: string[]) =>
    list.length > SHOWN
      ? `${list.slice(0, SHOWN).join(', ')} e mais ${list.length - SHOWN}`
      : list.join(', ');
  const parts = [
    check.added.length ? `novas: ${names(check.added)}` : '',
    check.removed.length ? `saíram: ${names(check.removed)}` : '',
  ].filter(Boolean);
  return `${check.label}: ${parts.join('; ')}`;
}

/**
 * Lê cada formulário uma vez só e confere as listas dele. Quem chama passa um
 * get que interrompe quando a sessão cai, como no resto da conferência.
 */
export async function checkLists(
  port: ListPort,
  code: string,
  watched: WatchedList[] = WATCHED_LISTS,
): Promise<ListCheck[]> {
  const pages = new Map<string, Promise<string>>();
  const out: ListCheck[] = [];
  for (const list of watched) {
    const path = list.path(code);
    if (!pages.has(path)) pages.set(path, port.get(path));
    const base = { control: list.control, label: list.label };
    let html: string;
    try {
      html = await pages.get(path)!;
    } catch (err) {
      // As listas não impedem o envio: uma leitura que falhou não derruba o
      // relatório, só a queda da sessão.
      if (port.isFatal?.(err)) throw err;
      const detail = err instanceof Error ? err.message : 'Falha inesperada';
      out.push({ ...base, added: [], detail, removed: [], status: 'erro' });
      continue;
    }
    const observed = selectOptions(html, list.control);
    if (!observed) {
      out.push({ ...base, added: [], removed: [], status: 'nao-encontrado' });
      continue;
    }
    const { added, removed } = compareList(list.expected, observed);
    out.push({ ...base, added, removed, status: added.length || removed.length ? 'mudou' : 'ok' });
  }
  return out;
}

/** Todas as listas como não lidas, com o motivo (sem o código do currículo, por exemplo). */
export function unreadLists(detail: string, watched: WatchedList[] = WATCHED_LISTS): ListCheck[] {
  return watched.map((list) => ({
    added: [],
    control: list.control,
    detail,
    label: list.label,
    removed: [],
    status: 'erro',
  }));
}
