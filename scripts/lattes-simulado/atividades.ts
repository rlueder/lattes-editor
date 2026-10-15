// As atividades de uma atuação no Lattes simulado: o formulário GN_ATIV_CARGO
// (pkg_ativ.cargo), de inclusão por natureza e de alteração, e o POST
// PKG_ATIV.cargo, com a grade de descrições em f_espec_l.
//
// Observado (lote 3 da recaptura de 15/10/2026): os campos de cada natureza,
// as opções do nível e do período, e o formato de f_espec_l
// ("<n>@<c>?<nome>!", oito linhas). Inferido: a ligação de cada campo com o
// XML, o link de cada atividade na tela de cargos e vínculos (com
// f_seq_funcao), o efeito do POST. Só a atividade de ensino grava; as outras
// naturezas respondem que o envio não é simulado.

import { insertInSchemaOrder } from '../../src/model/schema-order.ts';
import { childElements, element, getAttr, setAttr, type XElement } from '../../src/model/xml.ts';
import { lattesSchema } from '../../src/schema/lattes.ts';
import { COURSES } from './buscas.ts';
import { notSimulated } from './censo.ts';
import type { LattesState } from './estado.ts';
import { applyCensusForm, type FieldLink, renderCensusForm } from './formulario-censo.ts';
import * as h from './html.ts';
import type { SimRequest } from './pedido.ts';
import { html, type SimResponse } from './tipos.ts';

const LEVELS: Record<string, string> = {
  '401': 'GRADUACAO',
  '402': 'POS-GRADUACAO',
  '403': 'ESPECIALIZACAO',
  '404': 'APERFEICOAMENTO',
  '405': 'ENSINO-FUNDAMENTAL',
  '406': 'ENSINO-MEDIO',
  '409': 'OUTRO',
};
const toForm = Object.fromEntries(Object.entries(LEVELS).map(([c, x]) => [x, c]));

const LINKS: Record<string, FieldLink> = {
  f_ano_fim: { attr: 'ANO-FIM' },
  f_ano_ini: { attr: 'ANO-INICIO' },
  f_curso: { attr: 'NOME-CURSO' },
  f_mes_fim: { attr: 'MES-FIM' },
  f_mes_ini: { attr: 'MES-INICIO' },
  f_nivel: {
    attr: 'TIPO-ENSINO',
    toForm: (x) => toForm[x] ?? '',
    toXml: (f) => LEVELS[f] ?? '',
  },
  f_status: {
    attr: 'FLAG-PERIODO',
    toForm: (x) => ({ ANTERIOR: 'N', ATUAL: 'S' })[x] ?? '',
    toXml: (f) => ({ N: 'ANTERIOR', S: 'ATUAL' })[f] ?? '',
  },
};

/** As atividades de ensino da atuação. */
export function teaching(atuacao: XElement): XElement[] {
  const container = childElements(atuacao, 'ATIVIDADES-DE-ENSINO')[0];
  return container ? childElements(container, 'ENSINO') : [];
}

/** O formulário da natureza, como o lote 3 o leu; sem natureza, o do censo. */
const entryFor = (nature: string) =>
  ['1', '2', '4', '5', '6', '7', '8', '9', 'B'].includes(nature)
    ? `atividade-${nature}`
    : 'atividade';

export function cargoForm(req: SimRequest, state: LattesState, atuacao?: XElement): SimResponse {
  const seq = req.get('f_seq_funcao');
  const item =
    seq && atuacao
      ? teaching(atuacao).find((e) => getAttr(e, 'SEQUENCIA-FUNCAO-ATIVIDADE') === seq)
      : undefined;
  const nature = item ? '4' : (req.get('f_natur_ativ') ?? '');
  const codeOf = (el: XElement | undefined) => (el && getAttr(el, 'CODIGO-CURSO')) || '';
  const course = codeOf(item);
  const hidden = {
    f_cod: state.code,
    f_cod_curso: course,
    f_codinst: req.get('f_codinst') ?? '',
    f_ctr: item ? 'U' : 'I',
    f_natur_ativ: nature,
    f_seq_ativ: req.get('f_seq_ativ') ?? '',
    f_seq_funcao: seq ?? '',
  };
  const screen = { entry: entryFor(nature), links: nature === '4' ? LINKS : {} };
  return html(h.page('Atividade', renderCensusForm(screen, item, hidden, state)));
}

/** Grava a atividade de ensino: os campos ligados, o curso pelo código e as disciplinas de f_espec_l. */
export function cargoPost(req: SimRequest, state: LattesState, atuacao?: XElement): SimResponse {
  if (!atuacao || req.get('f_natur_ativ') !== '4' || req.get('f_ctr') !== 'I')
    return notSimulated();
  const container = state.ensure(atuacao, 'ATIVIDADES-DE-ENSINO');
  const seq = state.nextSeq(atuacao, 'ENSINO', 'SEQUENCIA-FUNCAO-ATIVIDADE');
  const item = element('ENSINO', { 'SEQUENCIA-FUNCAO-ATIVIDADE': seq });
  applyCensusForm({ entry: 'atividade-4', links: LINKS }, item, req, state);
  const code = req.get('f_cod_curso') || req.get('f_cod_curso2');
  if (code) {
    const hit = Object.values(COURSES)
      .flat()
      .find(([value]) => value.trim().slice(1) === code);
    setAttr(item, 'CODIGO-CURSO', code);
    if (hit) setAttr(item, 'NOME-CURSO', hit[1]);
  }
  for (const [, n, name] of (req.get('f_espec_l') ?? '').matchAll(/(\d+)@[^?]*\?([^!]*)!/g)) {
    if (!name) continue;
    item.children.push(
      element('DISCIPLINA', { 'SEQUENCIA-ESPECIFICACAO': n! }, [{ kind: 'text', value: name }]),
    );
  }
  insertInSchemaOrder(lattesSchema, container, item);
  state.touch();
  return html(
    h.savedScript(
      `PKG_ATIV.cargos_vinculos?f_cod=${state.code}&f_seq_ativ=${getAttr(atuacao, 'SEQUENCIA-ATIVIDADE')}`,
    ),
  );
}
