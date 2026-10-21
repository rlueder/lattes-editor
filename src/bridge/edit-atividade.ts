// Alterar uma atividade de uma atuação que já está no Lattes (formulário
// GN_ATIV_CARGO, POST PKG_ATIV.cargo). Lido em 19/10/2026 no Lattes real, só
// por GET, na edição de duas atividades do currículo:
//
// - A tela de cargos e vínculos da atuação (PKG_ATIV.cargos_vinculos) traz
//   cada atividade como um link PKG_ATIV.cargo com f_natur_ativ, f_seq_ativ,
//   f_codinst e f_seq_funcao, que são a natureza, a SEQUENCIA-ATIVIDADE da
//   atuação, o CODIGO-INSTITUICAO dela (com a letra na frente) e a
//   SEQUENCIA-FUNCAO-ATIVIDADE da atividade no XML.
// - A descrição (o cargo, o serviço, o estágio…) é a grade providerDetAtiv,
//   linhas {l, c}. O check() a serializa em f_espec_l como "n@c?l!" por
//   linha, completada até 8 com "n@?!"; uma linha digitada vai com c 0, e a
//   excluída vai em f_exc ("c?"). O check() exige ao menos uma descrição.
// - O período: f_status (N anterior, S atual), f_mes_ini, f_ano_ini,
//   f_mes_fim, f_ano_fim.
//
// No XML a descrição é um atributo da atividade (ESTAGIO-REALIZADO,
// SERVICO-REALIZADO…), observado na exportação de 18/10/2026 com uma linha
// por atividade. Com mais de uma linha na grade, como o XML as junta não foi
// visto, e a descrição vai à mão.

import type { Change } from '../model/changes.ts';
import { foldText } from '../model/fold-text.ts';
import { getAttr, type XElement } from '../model/xml.ts';
import type { LattesPort, OpResult } from './apply.ts';
import { getChecked, sameCode, Stop } from './create-shared.ts';
import {
  encodeLatin1Form,
  pairValue,
  setPairs,
  successfulPairs,
  withScriptValues,
} from './form.ts';
import { findLinks, isLogonPage } from './lattes-html.ts';
import { ACTIVITY_ORGAN_ELEMENTS, activityOrgansPath } from './organ-windows.ts';
import type { FieldValues, OpBase } from './plan.ts';
import { readProvider } from './production/grids.ts';
import {
  ORGAN_PARTS,
  type OrganChoice,
  organLoose,
  organText,
  resolveOrgan,
} from './production/organ.ts';

/** Alterar atividades pelo conector. */
export const EDIT_ATIVIDADES_ENABLED = true;

/**
 * Cada atividade do XML: a natureza no Lattes, o atributo da descrição e, nas
 * que guardam a grade em elementos filhos (as disciplinas do ensino), se a
 * página de edição já foi lida (gridRead): só então o envio manda a grade
 * como a página a trouxe. As que têm órgão estão em ACTIVITY_ORGAN_ELEMENTS
 * (organ-windows.ts).
 */
export const ACTIVITY_TYPES: Record<
  string,
  { description?: string; gridRead?: boolean; natur: string }
> = {
  'CONSELHO-COMISSAO-E-CONSULTORIA': { description: 'ESPECIFICACAO', natur: 'B' },
  'DIRECAO-E-ADMINISTRACAO': { description: 'CARGO-OU-FUNCAO', natur: '1' },
  ENSINO: { gridRead: true, natur: '4' },
  ESTAGIO: { description: 'ESTAGIO-REALIZADO', natur: '5' },
  'EXTENSAO-UNIVERSITARIA': {
    description: 'ATIVIDADE-DE-EXTENSAO-REALIZADA',
    natur: '7',
  },
  'OUTRA-ATIVIDADE-TECNICO-CIENTIFICA': {
    description: 'ATIVIDADE-REALIZADA',
    natur: '9',
  },
  'PESQUISA-E-DESENVOLVIMENTO': { natur: '2' },
  'SERVICO-TECNICO-ESPECIALIZADO': { description: 'SERVICO-REALIZADO', natur: '6' },
  'TREINAMENTO-MINISTRADO': { natur: '8' },
};

export interface AtividadeOp extends OpBase {
  codInst?: string;
  /** A descrição antes e depois, quando a mudança é dela (uma linha na grade). */
  description?: { after: string; before: string };
  kind: 'atividade';
  natur: string;
  /** O órgão ou a unidade novos, pela janela de órgãos da atividade (organ.ts). */
  organ?: OrganChoice;
  seqAtiv: string;
  seqFuncao: string;
}

export const isAtividadeOp = (op: { kind: string }): op is AtividadeOp => op.kind === 'atividade';

const PERIOD: Record<string, [string, (v: string) => string | undefined]> = {
  'ANO-FIM': ['f_ano_fim', (v) => v],
  'ANO-INICIO': ['f_ano_ini', (v) => v],
  'FLAG-PERIODO': ['f_status', (v) => ({ ANTERIOR: 'N', ATUAL: 'S' })[v]],
  'MES-FIM': ['f_mes_fim', (v) => v],
  'MES-INICIO': ['f_mes_ini', (v) => v],
};

const ORGAN = new Set(['CODIGO-ORGAO', 'NOME-ORGAO', 'CODIGO-UNIDADE', 'NOME-UNIDADE']);

/**
 * O órgão ou a unidade da atividade, que o XML guarda na própria atividade e
 * a página escolhe pela janela de órgãos (prc_orgao_cargo): como no projeto,
 * a troca precisa do código, e o órgão não fica vazio pelo conector.
 */
function planActivityOrgan(change: Change, el: XElement): OrganChoice | { reason: string } {
  const now = (attr: string) => getAttr(el, attr) ?? '';
  const was = (attr: string) => change.fields.find((f) => f.attr === attr)?.before ?? now(attr);
  const { organ, unit } = ORGAN_PARTS;
  if (!change.fields.some((f) => f.attr === organ.code || f.attr === unit.code)) {
    return { reason: 'Órgão e unidade: escolha pela lista do Lattes, que grava o código junto' };
  }
  const code = now(unit.code) || now(organ.code);
  if (!code)
    return { reason: 'O órgão da atividade não fica vazio pelo conector; troque no Lattes' };
  return {
    before: was(unit.code) || was(organ.code),
    beforeText: organText(was(organ.name), was(unit.name)),
    code,
    ...(now(unit.code) ? { parent: now(organ.code) } : {}),
  };
}

/** A atividade da mudança, ou o motivo de ficar à mão; undefined se não é de atividade. */
export function planAtividade(
  change: Change,
  chain: readonly XElement[],
  label: string,
): AtividadeOp | { reason: string } | undefined {
  const type = ACTIVITY_TYPES[change.element];
  if (!type) return undefined;
  const el = chain.at(-1);
  const atuacao = chain.find((e) => e.name === 'ATUACAO-PROFISSIONAL');
  const seqAtiv = atuacao && getAttr(atuacao, 'SEQUENCIA-ATIVIDADE');
  const seqFuncao = el && getAttr(el, 'SEQUENCIA-FUNCAO-ATIVIDADE');
  if (change.kind !== 'alterado') return undefined;
  // Pesquisa e desenvolvimento e treinamento não têm a descrição numa linha
  // só, e a grade providerDetAtiv deles não foi lida na edição: o envio a
  // reescreveria sem saber o que ela guarda. A do ensino são as disciplinas
  // ({l, c}, lidas em 20/10/2026 numa atividade de teste), que vão como vieram.
  if (!type.description && !type.gridRead) {
    return {
      reason:
        'Alterar esta atividade vai à mão: o formulário dela no Lattes ainda não foi lido pelo conector',
    };
  }
  if (!el || !seqAtiv || !seqFuncao) return { reason: 'Atividade sem número de sequência' };
  const set: FieldValues = {};
  const expect: FieldValues = {};
  const lacks: string[] = [];
  let description: AtividadeOp['description'];
  let organ: OrganChoice | undefined;
  if (change.fields.some((f) => ORGAN.has(f.attr))) {
    // O ensino troca o órgão pelo nível e o curso (seção 22).
    if (!ACTIVITY_ORGAN_ELEMENTS.has(change.element)) {
      return {
        reason:
          type.natur === '4'
            ? 'O formulário de ensino do Lattes não tem: órgão (tem o nível e o curso)'
            : 'O órgão desta atividade não vai pela lista do Lattes; troque no Lattes',
      };
    }
    const chosen = planActivityOrgan(change, el);
    if ('reason' in chosen) return chosen;
    organ = chosen;
  }
  for (const f of change.fields) {
    const period = PERIOD[f.attr];
    if (period) {
      const [field, toForm] = period;
      const after = toForm(f.after);
      const before = toForm(f.before);
      if (after === undefined || before === undefined) {
        return { reason: `Valor sem correspondência no formulário do Lattes: ${f.label}` };
      }
      set[field] = after;
      expect[field] = before;
    } else if (ORGAN.has(f.attr)) continue;
    else if (type.description === f.attr) {
      // O check() da página exige ao menos uma descrição.
      if (!f.after.trim()) return { reason: `O Lattes exige a descrição da atividade: ${f.label}` };
      description = { after: f.after, before: f.before };
    } else lacks.push(f.label);
  }
  if (lacks.length > 0) {
    return { reason: `O formulário de atividade do Lattes não tem: ${lacks.join(', ')}` };
  }
  // O período anterior pede o fim; o atual, nenhum (o check() da página).
  if (set.f_status === 'S') Object.assign(set, { f_ano_fim: '', f_mes_fim: '' });
  return {
    codInst: (atuacao && getAttr(atuacao, 'CODIGO-INSTITUICAO')) || undefined,
    ...(description ? { description } : {}),
    expect,
    key: change.key,
    kind: 'atividade',
    label,
    natur: type.natur,
    ...(organ ? { organ } : {}),
    seqAtiv,
    seqFuncao,
    set,
  };
}

interface Row {
  c: string;
  l: string;
}

const rowsOf = (html: string): Row[] | undefined =>
  readProvider(html, 'providerDetAtiv')
    ?.filter((r) => typeof r.l === 'string' && r.l)
    .map((r) => ({ c: String(r.c ?? '0'), l: String(r.l) }));

/** A grade de descrições como o check() a monta. */
export function specFromRows(rows: readonly Row[]): string {
  let out = '';
  for (let i = 1; i <= Math.max(8, rows.length); i++) {
    const row = rows[i - 1];
    out += row ? `${i}@${row.c}?${row.l}!` : `${i}@?!`;
  }
  return out;
}

const same = (a: string, b: string) => foldText(a.trim()) === foldText(b.trim());

async function locate(op: AtividadeOp, port: LattesPort): Promise<string> {
  const menu = await port.menuHtml();
  const lista = findLinks(menu, 'pkg_ativ.lista')[0];
  if (!lista) throw new Stop('erro', 'Atuação profissional não encontrada no menu do Lattes');
  const grids = findLinks(await getChecked(port, lista.path), 'pkg_ativ.cargos_vinculos').filter(
    (l) =>
      l.params.f_seq_ativ === op.seqAtiv &&
      (!op.codInst || sameCode(l.params.f_codinst, op.codInst)),
  );
  if (grids.length !== 1) {
    throw new Stop(
      'erro',
      `Atuação ${op.seqAtiv} não encontrada no Lattes (${grids.length} achadas)`,
    );
  }
  const activities = findLinks(await getChecked(port, grids[0]!.path), 'pkg_ativ.cargo').filter(
    (l) =>
      l.params.f_seq_funcao === op.seqFuncao &&
      (l.params.f_natur_ativ ?? '').toUpperCase() === op.natur &&
      !l.params.f_ctr,
  );
  if (activities.length !== 1) {
    throw new Stop(
      'divergente',
      'A atividade não está no Lattes como o editor espera; nada foi enviado',
    );
  }
  return activities[0]!.path;
}

export async function applyAtividade(op: AtividadeOp, port: LattesPort): Promise<OpResult> {
  const result = (status: OpResult['status'], detail: string): OpResult => ({
    detail,
    key: op.key,
    status,
  });
  let posted = false;
  try {
    const path = await locate(op, port);
    const html = await getChecked(port, path);
    const controls = withScriptValues(html, port.readForm(html, 'GN_ATIV_CARGO'));
    const rows = rowsOf(html);
    if (!controls || !rows) {
      return result('erro', 'A página da atividade no Lattes não veio como o conector conhece');
    }
    const pairs = successfulPairs(controls);
    if (pairValue(pairs, 'f_ctr') !== 'U') {
      return result('erro', 'O formulário não está em modo de alteração');
    }
    const wrong = Object.entries(op.expect).filter(
      ([f, v]) => !same(pairValue(pairs, f) ?? '', v ?? ''),
    );
    // A descrição: a única linha da grade, no lugar dela, com o mesmo c.
    let wanted = rows;
    if (op.description) {
      if (rows.length > 1) {
        return result(
          'erro',
          'A atividade tem mais de uma descrição no Lattes, e como a exportação as junta não foi visto; troque no Lattes',
        );
      }
      // A grade vazia com uma descrição no editor também é divergência.
      if (!same(rows[0]?.l ?? '', op.description.before)) wrong.push(['descrição', '']);
      wanted = [{ c: rows[0]?.c ?? '0', l: op.description.after }];
    }
    if (wrong.length > 0) {
      return result(
        'divergente',
        `O Lattes não está como o editor espera: ${wrong.map(([f]) => f).join(', ')}`,
      );
    }
    // O órgão novo, pela janela de órgãos da atividade, só com GET.
    let chosen: FieldValues = {};
    let organShown: string | undefined;
    let unitName: string | undefined;
    if (op.organ) {
      const shown = controls.find((c) => c.name === 'f_orgao')?.value ?? '';
      const resolved = await resolveOrgan(op.organ, port, pairs, shown, {
        institution: pairValue(pairs, 'f_codinst') ?? '',
        path: activityOrgansPath,
      });
      if ('status' in resolved) return result(resolved.status, resolved.detail);
      chosen = resolved.set;
      organShown = resolved.shown;
      if (op.organ.parent) unitName = resolved.name;
    }
    const action =
      /<form\b[^>]*name\s*=\s*["']?GN_ATIV_CARGO[^>]*action\s*=\s*["']?([^"'\s>]+)/i.exec(
        html,
      )?.[1] ?? 'PKG_ATIV.cargo';
    posted = true;
    const response = await port.post(
      action,
      encodeLatin1Form(
        setPairs(pairs, { ...op.set, ...chosen, f_espec_l: specFromRows(wanted), f_exc: '' }),
      ),
    );
    if (isLogonPage(response)) return result('sessao', 'A sessão do Lattes expirou; entre de novo');
    const afterHtml = await getChecked(port, path);
    const after = withScriptValues(afterHtml, port.readForm(afterHtml, 'GN_ATIV_CARGO'));
    const afterRows = rowsOf(afterHtml);
    if (!after || !afterRows) {
      return result(
        'divergente',
        'Depois do envio, a página da atividade não pôde ser relida; confira no Lattes',
      );
    }
    const afterPairs = successfulPairs(after);
    const notSaved = Object.entries(op.set)
      .filter(([f, v]) => !same(pairValue(afterPairs, f) ?? '', v ?? ''))
      .map(([f]) => f);
    if (afterRows.length !== wanted.length || afterRows.some((r, i) => !same(r.l, wanted[i]!.l))) {
      notSaved.push('descrição');
    }
    // A releitura confere o código, que a página da atividade devolve nos
    // ocultos. O texto de f_orgao (desabilitado) só vale sem código: com uma
    // unidade, a página mostra "/Unidade", sem o órgão de cima (21/10/2026).
    if (op.organ && organShown !== undefined) {
      const bare = (c: string) => c.trim().replace(/^[A-Z]/, '');
      const codeAfter = bare(
        pairValue(afterPairs, 'f_codorgao') || pairValue(afterPairs, 'f_codorgao2') || '',
      );
      const organAfter = organLoose(after.find((c) => c.name === 'f_orgao')?.value);
      // Sem código, o texto: "órgão/unidade", ou só a unidade, como a página
      // mostra. O nome da unidade vem da janela de órgãos, não do texto.
      const saved = codeAfter
        ? codeAfter === bare(op.organ.code)
        : organAfter === organLoose(organShown) ||
          (unitName !== undefined && organAfter === organLoose(unitName));
      if (!saved) notSaved.push('órgão');
    }
    if (notSaved.length > 0) {
      return result('divergente', `O Lattes não gravou: ${notSaved.join(', ')}. Confira no Lattes`);
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
