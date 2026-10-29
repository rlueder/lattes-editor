// O que "Atualizar do Lattes" lê pelos formulários: os tipos do motor de
// alteração no lugar (src/bridge/production/targets/), agrupados pela lista do
// menu que os mostra. Uma lista com mais de um tipo (as orientações
// concluídas, livros e capítulos) é um grupo só; a natureza do formulário diz
// de qual tipo é cada linha.
//
// Ficam de fora, com o motivo, os tipos cujo formulário não basta para montar
// o item: as linhas deles só são contadas, e o resultado diz "não lido".

import { elementLabel } from '../../labels/labels.ts';
import { PRODUCTION_TARGETS } from '../production/targets/index.ts';
import type { ProductionTarget } from '../production/types.ts';

/** Os tipos que ficam de fora, pelo id (ou pelo começo dele), com o motivo. */
export const LEFT_OUT: Record<string, string> = {
  licenca:
    'a licença fica dentro de um registro ou patente, e a lista não diz de qual; o tipo e a data são os únicos campos',
  'linha-de-pesquisa':
    'a linha de pesquisa fica dentro de uma atuação, e o formulário não diz de qual',
  patente:
    'a patente guarda datas e situações numa grade de histórico e os depositantes junto dos autores, que a leitura não refaz',
  projeto:
    'o projeto fica dentro de uma atuação, com equipe, financiadores e órgão que o formulário guarda em grades próprias',
  registro: 'os registros guardam titulares e datas em grades que a leitura não refaz',
};

/** O motivo de um tipo ficar de fora, ou undefined quando ele é lido. */
export function leftOutReason(id: string): string | undefined {
  const key = Object.keys(LEFT_OUT).find((k) => id === k || id.startsWith(`${k}-`));
  return key ? LEFT_OUT[key] : undefined;
}

/** Os rótulos das listas com mais de um tipo, como o menu do Lattes os mostra. */
const GROUP_LABELS: Record<string, string> = {
  'pkg_banca_julg.lista': 'Bancas julgadoras',
  'pkg_banca_trab.lista': 'Bancas de trabalhos de conclusão',
  'pkg_lvr_cap.lista': 'Livros e capítulos',
  'pkg_orient.lista?f_tipo=A': 'Orientações em andamento',
  'pkg_orient.lista?f_tipo=C': 'Orientações concluídas',
};

export interface RefreshGroup {
  /** A lista e os parâmetros que a distinguem, como listKey (test-ledger.ts) a escreve. */
  id: string;
  label: string;
  params: Record<string, string>;
  proc: string;
  /** Lido pelos formulários; sem isso, as linhas só são contadas. */
  readable: boolean;
  /** Por que não é lido. */
  reason?: string;
  targets: ProductionTarget[];
}

const groupId = (t: ProductionTarget) => {
  const params = Object.entries(t.list.params ?? {})
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('&');
  return params ? `${t.list.proc.toLowerCase()}?${params}` : t.list.proc.toLowerCase();
};

let groups: RefreshGroup[] | undefined;

/** Os grupos de leitura, uma vez só. */
export function refreshGroups(): RefreshGroup[] {
  if (groups) return groups;
  const byId = new Map<string, RefreshGroup>();
  for (const t of PRODUCTION_TARGETS) {
    const id = groupId(t);
    const reason = leftOutReason(t.id);
    const g = byId.get(id) ?? {
      id,
      label: GROUP_LABELS[id] ?? elementLabel(t.element),
      params: t.list.params ?? {},
      proc: t.list.proc.toLowerCase(),
      readable: true,
      targets: [],
    };
    g.targets.push(t);
    // Um tipo de fora deixa o grupo inteiro de fora: a linha não diz o tipo.
    if (reason) {
      g.readable = false;
      g.reason ??= reason;
    }
    byId.set(id, g);
  }
  groups = [...byId.values()];
  return groups;
}

/**
 * O grupo de uma lista lida (a chave de listKey, sem o f_cod): o de mesmo
 * procedimento cujos parâmetros a lista tem, o mais específico. Parâmetro
 * vazio no alvo é a lista que não o tem. Parâmetros a mais na lista (o
 * f_sta_divulgacao_cientifica) não contam.
 */
export function groupOfList(key: string): RefreshGroup | undefined {
  const [path = '', query = ''] = key.split('?');
  const params = new URLSearchParams(query);
  const fits = refreshGroups().filter(
    (g) =>
      g.proc === path.toLowerCase() &&
      Object.entries(g.params).every(([k, v]) => (v === '' ? !params.get(k) : params.get(k) === v)),
  );
  return fits.sort((a, b) => Object.keys(b.params).length - Object.keys(a.params).length)[0];
}

/** Os procedimentos dos formulários que a leitura pode abrir, em minúsculas. */
export function readableFormProcs(): Set<string> {
  return new Set(
    refreshGroups()
      .filter((g) => g.readable)
      .flatMap((g) => g.targets.map((t) => t.list.formProc.toLowerCase())),
  );
}

/** Os nomes de <form> que as linhas de um grupo podem abrir, sem repetir. */
export function formNamesOf(groupId: string): string[] {
  const g = refreshGroups().find((x) => x.id === groupId);
  return [...new Set(g?.targets.map((t) => t.form.name) ?? [])];
}
