// Áreas de atuação pelo formulário do Lattes (prc_area_atuacao, GN_AREA_ATU,
// lido em 18/10/2026; docs/lattes_internals.md, seção 18). A página guarda as
// áreas no vetor areaProvider ({l, c, priv, ...}, uma por linha) e o check()
// as serializa: em f_area_l, os valores das chaves l, c, r e p de cada linha,
// na ordem em que a linha os tem, separados por "|" (o r com a letra na
// frente), e as linhas separadas por "@"; em f_privacidade, o priv de cada
// linha, também por "@". O envio vai inteiro, com f_ctr=I. Uma área da árvore
// (areaDP do menu) tem l, n, c e b, e por isso vai como "nome|código"; a
// chave r não aparece nem nas linhas lidas nem nas da árvore.
//
// Uma operação leva a lista inteira, a de antes (desfeitas as mudanças da
// fila nas áreas) e a de depois. Duas mudanças nas áreas viram operações
// iguais: a segunda acha o Lattes já como o editor quer e não envia nada.

import { type Change, resolvePath } from '../model/changes.ts';
import { foldText } from '../model/fold-text.ts';
import { childElements, element, getAttr, type XElement } from '../model/xml.ts';
import type { LattesPort, OpResult } from './apply.ts';
import { getChecked, Stop } from './create-shared.ts';
import { encodeLatin1Form, setPairs, successfulPairs, withScriptValues } from './form.ts';
import { findLinks, isLogonPage } from './lattes-html.ts';
import { type AreaNode, parseAreaTree } from './lattes-lists.ts';
import type { OpBase } from './plan.ts';
import { readProvider } from './production/grids.ts';

/** O Lattes aceita até seis áreas de atuação (areaNumMaxRegistros da página). */
export const MAX_AREAS = 6;

/** Áreas de atuação pelo conector. Ligada para o teste ao vivo. */
export const EDIT_AREAS_ENABLED = true;

/** Uma área de atuação como o XML a guarda: os quatro nomes. */
export interface AreaRow {
  area: string;
  bigArea: string;
  specialty: string;
  subArea: string;
}

export interface AreasOp extends OpBase {
  after: AreaRow[];
  before: AreaRow[];
  kind: 'areas-atuacao';
}

export const isAreasOp = (op: { kind: string }): op is AreasOp => op.kind === 'areas-atuacao';

const ELEMENT = 'AREA-DE-ATUACAO';

const rowOf = (el: XElement): AreaRow => ({
  area: getAttr(el, 'NOME-DA-AREA-DO-CONHECIMENTO') ?? '',
  bigArea: getAttr(el, 'NOME-GRANDE-AREA-DO-CONHECIMENTO') ?? '',
  specialty: getAttr(el, 'NOME-DA-ESPECIALIDADE') ?? '',
  subArea: getAttr(el, 'NOME-DA-SUB-AREA-DO-CONHECIMENTO') ?? '',
});

/** O nome que a linha da página mostra: o do nível mais fundo preenchido. */
export const areaLabel = (r: AreaRow) => (r.specialty || r.subArea || r.area).trim();

const bySequence = (a: XElement, b: XElement) =>
  Number(getAttr(a, 'SEQUENCIA-AREA-DE-ATUACAO') ?? 0) -
  Number(getAttr(b, 'SEQUENCIA-AREA-DE-ATUACAO') ?? 0);

/** As áreas antes das mudanças da fila nelas: desfaz cada uma na lista de agora. */
function originalRows(changes: readonly Change[], current: XElement[], root: XElement) {
  let list = [...current];
  for (const c of changes) {
    const target = resolvePath(root, c.path).at(-1);
    if (c.kind === 'novo') list = list.filter((m) => m !== target);
    else if (c.kind === 'removido') {
      list.push(element(c.element, Object.fromEntries(c.fields.map((f) => [f.attr, f.before]))));
    } else {
      list = list.map((m) =>
        m === target
          ? {
              ...m,
              attrs: m.attrs.map((x) => {
                const f = c.fields.find((y) => y.attr === x.name);
                return f ? { ...x, value: f.before } : x;
              }),
            }
          : m,
      );
    }
  }
  return list.sort(bySequence).map(rowOf);
}

/** A operação das áreas de atuação, ou o motivo de ficar à mão. */
export function planAreas(
  change: Change,
  chain: XElement[],
  label: string,
  siblings: readonly Change[] = [],
): AreasOp | { reason: string } {
  const root = chain[0];
  const general = root && childElements(root, 'DADOS-GERAIS')[0];
  const container = general && childElements(general, 'AREAS-DE-ATUACAO')[0];
  const current = container ? childElements(container, ELEMENT).sort(bySequence) : [];
  if (!root) return { reason: 'O item não existe mais na cópia de trabalho' };
  const related = [
    change,
    ...siblings.filter((c) => c.key !== change.key && c.element === ELEMENT),
  ];
  const after = current.map(rowOf);
  const before = originalRows(related, current, root);
  if (after.length > MAX_AREAS) {
    return { reason: `O Lattes aceita até ${MAX_AREAS} áreas de atuação` };
  }
  if (after.some((r) => !r.area.trim())) {
    return { reason: 'Área de atuação sem área: o Lattes não aceita só a grande área' };
  }
  return { after, before, expect: {}, key: change.key, kind: 'areas-atuacao', label, set: {} };
}

/** A grande área do XML (CIENCIAS_EXATAS_E_DA_TERRA) pelo nome da árvore. */
export const bigKey = (label: string) => {
  const v = foldText(label)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
  return v === 'OUTRA' ? 'OUTROS' : v;
};

/** O código do nó da árvore de áreas com esses nomes; undefined fora dela. */
export function areaCode(tree: readonly AreaNode[], r: AreaRow): string | undefined {
  const path = [r.area, r.subArea, r.specialty].map((n) => n.trim()).filter(Boolean);
  for (const big of tree) {
    if (bigKey(big.l) !== r.bigArea) continue;
    let nodes = big.b ?? [];
    let hit: AreaNode | undefined;
    for (const name of path) {
      hit = nodes.find((n) => foldText(n.l) === foldText(name));
      if (!hit) break;
      nodes = hit.b ?? [];
    }
    if (hit) return hit.c;
  }
  return undefined;
}

interface PageRow {
  c: string;
  l: string;
  priv: string;
}

const pageRows = (html: string): PageRow[] | undefined =>
  readProvider(html, 'areaProvider')
    ?.filter((r) => typeof r.l === 'string' && r.l.trim())
    .map((r) => ({ c: String(r.c ?? ''), l: String(r.l), priv: String(r.priv ?? '1') }));

const sameLabels = (rows: PageRow[], want: AreaRow[]) =>
  rows.length === want.length &&
  rows.every((r, i) => foldText(r.l) === foldText(areaLabel(want[i]!)));

export async function applyAreas(op: AreasOp, port: LattesPort): Promise<OpResult> {
  const result = (status: OpResult['status'], detail: string): OpResult => ({
    detail,
    key: op.key,
    status,
  });
  let posted = false;
  try {
    const menu = await port.menuHtml();
    const link = findLinks(menu, 'prc_area_atuacao')[0];
    if (!link) return result('erro', 'Áreas de atuação não encontradas no menu do Lattes');
    const html = await getChecked(port, link.path);
    const controls = withScriptValues(html, port.readForm(html, 'GN_AREA_ATU'));
    const rows = pageRows(html);
    if (!controls || !rows) {
      return result(
        'erro',
        'A página de áreas de atuação do Lattes não veio como o conector conhece',
      );
    }
    const pairs = successfulPairs(controls);
    const missing = ['f_area_l', 'f_privacidade', 'f_ctr'].filter(
      (f) => !pairs.some(([k]) => k === f),
    );
    if (missing.length > 0) {
      return result('erro', `O formulário de áreas do Lattes não tem ${missing.join(', ')}`);
    }
    // Duas mudanças nas áreas viram a mesma operação: a segunda acha o
    // Lattes já como o editor quer.
    if (sameLabels(rows, op.after)) {
      return result('conferido', 'O Lattes já estava assim; nada foi enviado');
    }
    if (!sameLabels(rows, op.before)) {
      return result('divergente', 'O Lattes não está como o editor espera: Áreas de atuação');
    }
    // O código de cada área: o da linha que o Lattes já tem com o mesmo nome
    // (inclusive as criadas pela pessoa, fora da árvore), senão o da árvore.
    const tree = parseAreaTree(menu) ?? [];
    const codeOf = (r: AreaRow) =>
      rows.find((p) => foldText(p.l) === foldText(areaLabel(r)))?.c ?? areaCode(tree, r);
    const wanted = op.after.map((r) => ({ c: codeOf(r), l: areaLabel(r) }));
    const unknown = wanted.filter((w) => !w.c).map((w) => w.l);
    if (unknown.length > 0) {
      return result(
        'erro',
        `Área fora da tabela do Lattes: ${unknown.join(', ')}. Inclua-a no Lattes uma vez`,
      );
    }
    const priv = (c: string) => rows.find((r) => r.c === c)?.priv ?? '1';
    const set = {
      f_area_l: wanted.map((w) => `${w.l}|${w.c}`).join('@'),
      f_ctr: 'I',
      f_privacidade: wanted.map((w) => priv(w.c!)).join('@'),
    };
    const action =
      /<form\b[^>]*name\s*=\s*["']?GN_AREA_ATU[^>]*action\s*=\s*["']?([^"'\s>]+)/i.exec(html)?.[1];
    posted = true;
    const response = await port.post(
      action ?? 'prc_area_atuacao',
      encodeLatin1Form(setPairs(pairs, set)),
    );
    if (isLogonPage(response)) return result('sessao', 'A sessão do Lattes expirou; entre de novo');
    const after = pageRows(await getChecked(port, link.path));
    if (!after || !sameLabels(after, op.after) || after.some((r, i) => r.c !== wanted[i]!.c)) {
      return result(
        'divergente',
        'O Lattes não gravou as áreas como o editor mandou. Confira no Lattes',
      );
    }
    // A privacidade de cada área que já estava fica como estava.
    if (after.some((r) => r.priv !== priv(r.c) && rows.some((p) => p.c === r.c))) {
      return result('divergente', 'A privacidade de uma área mudou no Lattes. Confira no Lattes');
    }
    return result('conferido', 'Gravado e conferido no Lattes');
  } catch (err) {
    if (err instanceof Stop) return result(err.status, err.message);
    const why = err instanceof Error ? err.message : String(err);
    return posted
      ? result('divergente', `Falha no meio do envio (${why}); confira no Lattes`)
      : result('erro', why);
  }
}

/** Para o painel: a lista como se lê. */
export const areasText = (rows: AreaRow[]) => rows.map(areaLabel).join('; ');
