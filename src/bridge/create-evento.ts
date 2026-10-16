// Incluir uma participação em evento no Lattes pelo formulário de eventos, em
// vez do Importar (LAT-57), atrás de CREATE_ITEMS_ENABLED (create.ts). A
// decisão, com a evidência, está em docs/inclusao_por_tipo.md: o Importar
// descarta em silêncio o evento sem a própria pessoa entre os participantes e
// gasta o número mesmo assim (seção 13 de docs/lattes_internals.md), e o
// formulário de eventos não tem participantes, porque é a própria pessoa quem
// inclui.
//
// Formulário GN_TEC, POST PKG_EVENTO.FORM (seção 16). Observados: os campos,
// as opções e o POST de alteração com a mesma resposta; a ligação de nome,
// ano, cidade, país, forma e divulgação científica com o XML (passada de
// edição do censo de 15/10/2026, 6 eventos); o F_TPO mandado com o texto do
// rótulo. Inferidos: o elemento pela natureza (F_COD_PROD), a forma de
// convidado e participante pelo rótulo, a resposta do POST de inclusão e o
// evento novo aparecer na lista com um f_seq novo.

import type { Change } from '../model/changes.ts';
import { foldText } from '../model/fold-text.ts';
import { childElements, firstChild, getAttr, type XElement } from '../model/xml.ts';
import { typedChoices } from '../schema/typed-choices.ts';
import type { LattesPort, OpResult } from './apply.ts';
import { CREATE_FIELD_LABELS } from './create-labels.ts';
import {
  filledChildren,
  getChecked,
  maybeCreated,
  overLimit,
  type Planned,
  readBack,
  readBackProblem,
  readPairs,
  type Result,
  Stop,
} from './create-shared.ts';
import { countryCode, EVENT_CODES } from './edit-items.ts';
import { encodeLatin1Form, pairValue, setPairs } from './form.ts';
import { findLinks, isLogonPage } from './lattes-html.ts';
import type { FieldValues } from './plan.ts';

export interface CreateEventoOp {
  expect: FieldValues;
  key: string;
  kind: 'criar-evento';
  label: string;
  set: FieldValues;
}

/** Os elementos de evento que o conector inclui pelo formulário. */
export const EVENT_ELEMENTS = new Set(Object.keys(EVENT_CODES));

/** Rádio F_FORMA (seção 16): 38 Convidado, 39 Participante, 40 Ouvinte. */
const FORMS: Record<string, string> = { Convidado: '38', Ouvinte: '40', Participante: '39' };

const basicsOf = (item: XElement) =>
  childElements(item).find((c) => c.name.startsWith('DADOS-BASICOS-'));
const detailOf = (item: XElement) =>
  childElements(item).find((c) => c.name.startsWith('DETALHAMENTO-'));

/** Atributos sem campo no formulário de eventos (seção 16), menos os vazios ou "não". */
const NO_FIELD = new Set([
  'CODIGO-INSTITUICAO',
  'DOI',
  'IDIOMA',
  'LOCAL-DO-EVENTO',
  'MEIO-DE-DIVULGACAO',
  'NOME-DO-EVENTO-INGLES',
  'NOME-INSTITUICAO',
]);

const LABELS: Record<string, string> = {
  'CODIGO-INSTITUICAO': 'Instituição promotora',
  DOI: 'DOI',
  'FLAG-RELEVANCIA': 'Relevância',
  IDIOMA: 'Idioma',
  'LOCAL-DO-EVENTO': 'Local do evento',
  'MEIO-DE-DIVULGACAO': 'Meio de divulgação',
  'NOME-DO-EVENTO-INGLES': 'Nome do evento em inglês',
  'NOME-INSTITUICAO': 'Instituição promotora',
};

/** O dono do currículo entre os participantes, pelo ID Lattes ou pelo nome. */
function onlyOwner(item: XElement, root: XElement | undefined): boolean {
  const people = childElements(item, 'PARTICIPANTE-DE-EVENTOS-CONGRESSOS');
  if (people.length === 0) return true;
  if (people.length > 1 || !root) return false;
  const p = people[0]!;
  const ownerId = getAttr(root, 'NUMERO-IDENTIFICADOR') ?? '';
  const id = getAttr(p, 'NRO-ID-CNPQ') ?? '';
  if (ownerId && id) return ownerId === id;
  const dg = firstChild(root, 'DADOS-GERAIS');
  const name = p.attrs.find((a) => a.name.startsWith('NOME-COMPLETO'))?.value ?? '';
  return (
    foldText(name) !== '' && foldText(name) === foldText((dg && getAttr(dg, 'NOME-COMPLETO')) ?? '')
  );
}

/** O evento que a mudança traz: o próprio item, ou o contêiner novo com um só. */
export function eventItem(el: XElement): XElement | undefined {
  if (EVENT_ELEMENTS.has(el.name)) return el;
  if (el.name !== 'PARTICIPACAO-EM-EVENTOS-CONGRESSOS') return undefined;
  const kids = childElements(el);
  return kids.length === 1 && EVENT_ELEMENTS.has(kids[0]!.name) ? kids[0] : undefined;
}

/** O dono do currículo é um dos participantes, pelo ID Lattes ou pelo nome? */
function ownerAmong(item: XElement, root: XElement | undefined): boolean {
  if (!root) return false;
  const ownerId = getAttr(root, 'NUMERO-IDENTIFICADOR') ?? '';
  const dg = firstChild(root, 'DADOS-GERAIS');
  const ownerName = foldText((dg && getAttr(dg, 'NOME-COMPLETO')) ?? '');
  return childElements(item, 'PARTICIPANTE-DE-EVENTOS-CONGRESSOS').some((p) => {
    const id = getAttr(p, 'NRO-ID-CNPQ') ?? '';
    if (ownerId && id) return ownerId === id;
    const name = p.attrs.find((a) => a.name.startsWith('NOME-COMPLETO'))?.value ?? '';
    return ownerName !== '' && foldText(name) === ownerName;
  });
}

/**
 * O Importar leva este evento? Só com a própria pessoa entre os
 * participantes: sem ela, o Importar diz que importou e descarta o evento
 * (seção 13 de docs/lattes_internals.md).
 */
export function eventCarriedByImport(item: XElement, root: XElement | undefined): boolean {
  return ownerAmong(item, root);
}

/** Os campos do formulário de eventos para o item, ou o motivo de ir à mão. */
function eventoFields(
  item: XElement,
  root: XElement | undefined,
): { set: FieldValues } | { reason: string } {
  const basics = basicsOf(item);
  const detail = detailOf(item);
  if (!basics || !detail) return { reason: 'O evento precisa dos dados básicos e do detalhamento' };
  if (!onlyOwner(item, root)) {
    return {
      reason:
        'Participantes além de você vão à mão: o formulário de eventos do Lattes não tem participantes',
    };
  }
  if (
    filledChildren(item, [basics.name, detail.name, 'PARTICIPANTE-DE-EVENTOS-CONGRESSOS']).length
  ) {
    return {
      reason:
        'O formulário de eventos do Lattes não tem palavras-chave, áreas, setores nem informações adicionais',
    };
  }
  const absent = [...basics.attrs, ...detail.attrs]
    .filter((a) => a.value.trim() && NO_FIELD.has(a.name))
    .filter((a) => !(a.name === 'MEIO-DE-DIVULGACAO' && a.value === 'NAO_INFORMADO'))
    .map((a) => LABELS[a.name] ?? a.name);
  if (getAttr(basics, 'FLAG-RELEVANCIA') === 'SIM') absent.push(LABELS['FLAG-RELEVANCIA']!);
  if (absent.length > 0) {
    return {
      reason: `O formulário de eventos do Lattes não tem: ${[...new Set(absent)].join(', ')}`,
    };
  }
  const forma = getAttr(basics, 'FORMA-PARTICIPACAO') ?? '';
  const code = FORMS[forma];
  if (!code) return { reason: 'Escolha a forma de participação' };
  const tipo = getAttr(basics, 'TIPO-PARTICIPACAO') ?? '';
  const ouvinte = forma === 'Ouvinte';
  // Os tipos de cada forma, como montaTipoApres() os monta (seção 16).
  if (!ouvinte && !typedChoices(basics, 'TIPO-PARTICIPACAO')?.some((c) => c.value === tipo)) {
    return { reason: 'Escolha o tipo de participação' };
  }
  const country = countryCode(getAttr(basics, 'PAIS') ?? '');
  const flag = getAttr(basics, 'FLAG-DIVULGACAO-CIENTIFICA');
  const set: FieldValues = {
    f_ano: getAttr(basics, 'ANO') ?? '',
    f_cidade: getAttr(detail, 'CIDADE-DO-EVENTO') ?? '',
    F_COD_PROD: EVENT_CODES[item.name]!,
    F_FORMA: code,
    f_homepage: getAttr(basics, 'HOME-PAGE-DO-TRABALHO') ?? '',
    f_nme_evento: getAttr(detail, 'NOME-DO-EVENTO') ?? '',
    f_pais: country ?? '',
    F_STA_DIVULGACAO_CIENTIFICA: flag === 'SIM' ? 'S' : 'N',
    f_titulo: getAttr(basics, 'TITULO') ?? '',
    f_titulo_en: getAttr(basics, 'TITULO-INGLES') ?? '',
    F_TPO: ouvinte ? '' : tipo,
  };
  // check() do formulário (seção 16): nome, ano, país e, menos para ouvinte, título.
  if (!set.f_nme_evento || !/^\d{4}$/.test(set.f_ano ?? '')) {
    return { reason: 'O evento precisa do nome e do ano' };
  }
  if (!country) return { reason: 'País sem código na lista do Lattes' };
  if (!ouvinte && !set.f_titulo) return { reason: 'Quem apresenta precisa do título' };
  return { set };
}

/** Por que o evento não vai pelo formulário de eventos; undefined quando vai. */
export function eventoProblem(item: XElement, root: XElement | undefined): string | undefined {
  const fields = eventoFields(item, root);
  return 'reason' in fields ? fields.reason : undefined;
}

/** Uma participação em evento nova como inclusão; o motivo, quando vai à mão. */
export function planCreateEvento(
  change: Change,
  chain: XElement[],
  item: XElement,
  label: string,
): Planned<CreateEventoOp> {
  const fields = eventoFields(item, chain[0]);
  if ('reason' in fields) return fields;
  return { expect: {}, key: change.key, kind: 'criar-evento', label, set: fields.set };
}

// Lattes ----------------------------------------------------------------------------

const EVENTO_FORM = 'GN_TEC';

/** Por que o evento de quem apresenta fica divergente: o tipo não volta na releitura. */
export const TYPE_UNREAD =
  'Criada no Lattes, com os outros campos conferidos. O tipo da participação não dá para conferir daqui, porque a página do Lattes o monta por script; confira no Lattes';

const eventRows = (html: string) =>
  findLinks(html, 'PKG_EVENTO.form').filter((l) => l.params.f_seq);

export async function applyCreateEvento(op: CreateEventoOp, port: LattesPort): Promise<Result> {
  const result = (status: OpResult['status'], detail: string): Result => ({
    detail,
    key: op.key,
    status,
  });
  try {
    const lista = findLinks(await port.menuHtml(), 'pkg_evento.lista').find(
      (l) => !l.params.f_sta_divulgacao_cientifica,
    );
    if (!lista) throw new Stop('erro', 'Participação em eventos não encontrada no menu do Lattes');
    const listaHtml = await getChecked(port, lista.path);
    const before = eventRows(listaHtml);
    // Quem apresenta pode ter mais de um trabalho no mesmo evento: aí o título
    // também entra na chave. O ouvinte não tem título.
    const presenter = op.set.F_FORMA !== FORMS.Ouvinte;
    for (const row of before) {
      const { pairs } = await readPairs(port, row.path, EVENTO_FORM);
      if (
        foldText(pairValue(pairs, 'f_nme_evento') ?? '') === foldText(op.set.f_nme_evento ?? '') &&
        pairValue(pairs, 'f_ano') === op.set.f_ano &&
        pairValue(pairs, 'F_FORMA') === op.set.F_FORMA &&
        (!presenter ||
          foldText(pairValue(pairs, 'f_titulo') ?? '') === foldText(op.set.f_titulo ?? ''))
      ) {
        return result(
          'divergente',
          presenter
            ? 'O Lattes já tem essa participação (mesmo evento, ano, forma e título)'
            : 'O Lattes já tem essa participação (mesmo evento, ano e forma)',
        );
      }
    }
    const inclusion = findLinks(listaHtml, 'PKG_EVENTO.form').find((l) => !l.params.f_seq);
    if (!inclusion) throw new Stop('erro', 'Inclusão de evento não encontrada na lista do Lattes');
    const form = await readPairs(port, inclusion.path, EVENTO_FORM);
    if (pairValue(form.pairs, 'f_ctr') !== 'I') {
      return result('erro', 'O formulário não está em modo de inclusão');
    }
    // F_TPO nasce vazio e montaTipoApres() o preenche no clique: vai o texto do
    // rótulo (seção 16). Os outros campos precisam existir no formulário.
    const missing = Object.entries(op.set)
      .filter(([name, value]) => value && name !== 'F_TPO')
      .map(([name]) => name)
      .filter((name) => !form.controls.some((c) => c.name === name && c.type !== 'hidden'));
    if (missing.length > 0) {
      return result(
        'erro',
        `O formulário de eventos não tem: ${missing.map((f) => CREATE_FIELD_LABELS[f] ?? f).join(', ')}`,
      );
    }
    const limit = overLimit(form.controls, op.set);
    if (limit) return result('erro', limit);
    const response = await port.post(
      'PKG_EVENTO.FORM',
      encodeLatin1Form(setPairs(form.pairs, op.set)),
    );
    if (isLogonPage(response)) return result('sessao', 'A sessão do Lattes caiu; entre de novo');
    const mayExist = 'A participação pode ter sido criada';
    try {
      const known = new Set(before.map((l) => l.params.f_seq));
      const created = eventRows(await getChecked(port, lista.path)).filter(
        (l) => !known.has(l.params.f_seq),
      );
      if (created.length !== 1) {
        return maybeCreated(op.key, mayExist, `a lista mostra ${created.length} eventos novos`);
      }
      const seq = created[0]!.params.f_seq!;
      const assigned = { 'SEQUENCIA-PRODUCAO': seq };
      const saved = await readPairs(port, created[0]!.path, EVENTO_FORM);
      // A lista F_TPO é montada por script, e o HTML relido não traz o tipo
      // gravado (LAT-58): o tipo de quem apresenta fica sem conferir.
      const { F_TPO: tipo, ...checked } = op.set;
      const problem = readBackProblem(
        `Criada no Lattes (evento ${seq})`,
        readBack(saved, tipo ? checked : op.set),
      );
      if (problem) return { ...result('divergente', problem), assigned };
      if (tipo) return { ...result('conferido', `${TYPE_UNREAD} (evento ${seq})`), assigned };
      return { ...result('conferido', `Criada e conferida no Lattes (evento ${seq})`), assigned };
    } catch (err) {
      const why = err instanceof Error ? err.message : 'falha inesperada';
      return maybeCreated(op.key, mayExist, `a conferência falhou (${why})`);
    }
  } catch (err) {
    if (err instanceof Stop) return result(err.status, err.message);
    return result('erro', err instanceof Error ? err.message : 'Falha inesperada');
  }
}
