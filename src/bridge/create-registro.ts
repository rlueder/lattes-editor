// Incluir uma patente ou um registro no Lattes pelo conector (LAT-57), atrás
// de CREATE_ITEMS_ENABLED (create.ts). Os seis tipos usam o mesmo formulário,
// PKG_PATENTE_REGISTRO.form com f_cod_tipo, POST para
// PKG_PATENTE_REGISTRO.FORM (docs/lattes_internals.md, seção 17). Os campos de
// cada tipo, com limites e opções, são os da captura do censo de 15/10/2026
// (docs/lattes-formularios/).
//
// Observado: o formulário de cada tipo, o nome dele, os ocultos, as opções; a
// lista de patentes no menu; os parâmetros do link de inclusão das listas
// (seção 17). Inferido até o teste acompanhado: a ligação de cada campo com o
// atributo do XML (o currículo de quem capturou não tem nenhum registro; o
// rótulo de cada campo é a pista), a lista de cada tipo no menu, a resposta do
// POST, o item novo aparecer na lista com um f_seq novo, e o servidor aceitar
// a patente sem a janela prévia e sem o f_ctr=R (os campos do escritório e do
// número estão no próprio formulário).
//
// Fica à mão, com o motivo:
// - datas: na patente, na marca e na topografia elas só entram pela grade
//   serializada em f_dados_grid_datas, de formato não observado; na cultivar e
//   no desenho industrial há campo de texto, mas o formato da data nele também
//   não foi observado;
// - a patente inteira: check() do Lattes exige a data de depósito e o titular
//   ou depositante, que vão em grades de formato não observado;
// - autores além do dono do currículo, titulares, depositantes, palavras-chave,
//   áreas, setores e informações adicionais (grades que o conector não monta);
// - o que o formulário do tipo não tem (ano no desenho industrial, finalidade
//   na cultivar e na marca, finalidade em inglês, título da patente).

import type { Change } from '../model/changes.ts';
import { foldText } from '../model/fold-text.ts';
import { readAuthors } from '../model/production.ts';
import { childElements, firstChild, getAttr, type XElement } from '../model/xml.ts';
import type { LattesPort, OpResult } from './apply.ts';
import type { FormSpec } from './contract.ts';
import { CREATE_FIELD_LABELS } from './create-labels.ts';
import {
  absentFields,
  filledChildren,
  getChecked,
  hidden,
  type Mapper,
  maybeCreated,
  overLimit,
  type Planned,
  radio,
  readBack,
  readBackProblem,
  readPairs,
  reasonFrom,
  type Result,
  same,
  select,
  SESSION,
  Stop,
  text,
} from './create-shared.ts';
import { countryCode } from './edit-items.ts';
import { encodeLatin1Form, pairValue, setPairs } from './form.ts';
import { cvCodeFrom, findLinks, isLogonPage, type LattesLink } from './lattes-html.ts';
import type { FieldValues } from './plan.ts';

export interface CreateRegistroOp {
  /** Nenhum valor anterior: o item não existe no Lattes. */
  expect: FieldValues;
  key: string;
  kind: 'criar-registro';
  label: string;
  set: FieldValues;
  /** f_cod_tipo da lista e do formulário: PP patente, CP, CR, DI, MR, TC. */
  tipo: string;
}

interface RegistryType {
  /** Onde as datas entram no formulário deste tipo. */
  dates: 'campo' | 'grade';
  /** Os campos visíveis do formulário do tipo (censo de 15/10/2026). */
  fields: string[];
  tipo: string;
}

/** Elemento do XML → tipo do registro (seção 17; censo de 15/10/2026). */
export const REGISTRY_TYPES: Record<string, RegistryType> = {
  'CULTIVAR-PROTEGIDA': {
    dates: 'campo',
    fields: ['f_titulo', 'f_ano', 'f_pais', 'f_inst', 'f_cod_reg', 'f_sta_inovacao', 'f_titulo_en'],
    tipo: 'CP',
  },
  'CULTIVAR-REGISTRADA': {
    dates: 'campo',
    fields: ['f_titulo', 'f_ano', 'f_pais', 'f_inst', 'f_cod_reg', 'f_sta_inovacao', 'f_titulo_en'],
    tipo: 'CR',
  },
  'DESENHO-INDUSTRIAL': {
    dates: 'campo',
    fields: [
      'f_inst',
      'f_pais',
      'f_cod_reg',
      'f_titulo',
      'f_finalidade',
      'f_inst_financ',
      'f_sta_inovacao',
      'f_titulo_en',
    ],
    tipo: 'DI',
  },
  MARCA: {
    dates: 'grade',
    fields: [
      'f_inst',
      'f_pais',
      'f_cod_reg',
      'f_tipo',
      'f_natureza',
      'f_titulo',
      'f_ano',
      'f_sta_inovacao',
      'f_titulo_en',
    ],
    tipo: 'MR',
  },
  PATENTE: {
    dates: 'grade',
    fields: [
      'f_inst',
      'f_pais',
      'f_cod_reg',
      'f_tipo',
      'f_titulo',
      'f_nro_deposito_pct',
      'f_sta_inovacao',
      'f_home_page',
      'f_finalidade',
      'f_inst_financ',
      'f_titulo_en',
    ],
    tipo: 'PP',
  },
  'TOPOGRAFIA-DE-CIRCUITO-INTEGRADO': {
    dates: 'grade',
    fields: [
      'f_inst',
      'f_pais',
      'f_cod_reg',
      'f_titulo',
      'f_ano',
      'f_finalidade',
      'f_inst_financ',
      'f_sta_inovacao',
      'f_titulo_en',
    ],
    tipo: 'TC',
  },
};

/** Rádio do tipo da patente: PI e MU (seção 17), pelo código no fim do valor do XSD. */
const PATENT_TYPES: Record<string, string> = {
  MODELO_DE_UTILIDADE_MU: 'MU',
  PRIVILEGIO_DE_INOVACAO_PI: 'PI',
};

/**
 * Rádio do tipo da marca (censo: MPD de produto, MSV de serviço, MCL coletiva,
 * MCT certificação), pelo código no fim do valor do XSD (inferido).
 */
const BRAND_TYPES: Record<string, string> = {
  MARCA_REGISTRADA_COLETIVA_MCL: 'MCL',
  MARCA_REGISTRADA_DE_CERTIFICACAO_MCT: 'MCT',
  MARCA_REGISTRADA_DE_PRODUTO_MPD: 'MPD',
  MARCA_REGISTRADA_DE_SERVICO_MSV: 'MSV',
};

/** Rádio da natureza da marca: o valor de cada opção é o próprio rótulo (censo). */
const BRAND_NATURES = ['Figurativa', 'Nominativa', 'Mista', 'Tridimensional'];
const brandNature: Mapper = (v) => BRAND_NATURES.find((n) => foldText(n) === foldText(v));

/** Só "não" vai sem texto: com "sim", o formulário pede o potencial, que o XML não tem. */
const noInnovation: Mapper = (v) => (v === 'NAO' ? 'N' : undefined);

const country: Mapper = (v) => countryCode(v);

/** Atributo → campo, por parte do item. A ligação é pelo rótulo do campo (inferida). */
const BASICS: Record<string, [string, Mapper]> = {
  'ANO-DESENVOLVIMENTO': ['f_ano', same],
  'ANO-SOLICITACAO': ['f_ano', same],
  DENOMINACAO: ['f_titulo', same],
  'DENOMINACAO-INGLES': ['f_titulo_en', same],
  'FLAG-POTENCIAL-INOVACAO': ['f_sta_inovacao', noInnovation],
  'HOME-PAGE': ['f_home_page', same],
  PAIS: ['f_pais', country],
  TITULO: ['f_titulo', same],
  'TITULO-INGLES': ['f_titulo_en', same],
};

const DETAIL: Record<string, [string, Mapper]> = {
  FINALIDADE: ['f_finalidade', same],
  'INSTITUICAO-FINANCIADORA': ['f_inst_financ', same],
  NATUREZA: ['f_natureza', brandNature],
};

const REGISTRY: Record<string, [string, Mapper]> = {
  'CODIGO-DO-REGISTRO-OU-PATENTE': ['f_cod_reg', same],
  'INSTITUICAO-DEPOSITO-REGISTRO': ['f_inst', same],
  'NUMERO-DEPOSITO-PCT': ['f_nro_deposito_pct', same],
};

const DATES = new Set([
  'DATA-DE-CONCESSAO',
  'DATA-DE-PEDIDO-DE-EXAME',
  'DATA-DEPOSITO-PCT',
  'DATA-PEDIDO-DE-DEPOSITO',
]);

/** Os formatos de data acompanham as datas; FLAG-RELEVANCIA "não" é o padrão do editor. */
const SYSTEM = new Set(['FORMATO-DATA-DEPOSITO-PCT', 'FORMATO-DATA-PEDIDO']);

/**
 * Rótulos dos atributos dos registros nas mensagens de "vai à mão". A mudança
 * nova só lista os atributos do item, não os das partes; os rótulos ficam aqui
 * porque o conector não carrega os do editor (html-text.ts).
 */
const ATTR_LABELS: Record<string, string> = {
  'ANO-DESENVOLVIMENTO': 'Ano de desenvolvimento',
  'ANO-SOLICITACAO': 'Ano de solicitação',
  'CODIGO-DO-REGISTRO-OU-PATENTE': 'Número do registro',
  DENOMINACAO: 'Denominação',
  'DENOMINACAO-INGLES': 'Denominação em inglês',
  FINALIDADE: 'Finalidade',
  'FINALIDADE-INGLES': 'Finalidade em inglês',
  'FLAG-POTENCIAL-INOVACAO': 'Potencial de inovação',
  'FLAG-RELEVANCIA': 'Relevância',
  'HOME-PAGE': 'Home page',
  'INSTITUICAO-DEPOSITO-REGISTRO': 'Instituição de registro',
  'INSTITUICAO-FINANCIADORA': 'Instituição financiadora',
  NATUREZA: 'Natureza',
  'NOME-DO-DEPOSITANTE': 'Depositante',
  'NOME-DO-TITULAR': 'Titular',
  'NUMERO-DEPOSITO-PCT': 'Número do depósito PCT',
  PAIS: 'País',
  'TIPO-PATENTE': 'Tipo',
  TITULO: 'Título',
  'TITULO-INGLES': 'Título em inglês',
  'TITULO-PATENTE': 'Título da patente',
};

const labelOf = (change: Change, attr: string) =>
  change.fields.find((f) => f.attr === attr)?.label ?? ATTR_LABELS[attr] ?? attr;

const GRID_DATES = 'o formato da grade de datas (f_dados_grid_datas) não foi observado';
const FIELD_DATES = 'o formato da data no formulário não foi observado';

/** O dono do currículo, pelo ID Lattes ou, sem ele, pelo nome. */
function isOwner(author: { lattesId: string; name: string }, root: XElement | undefined) {
  if (!root) return false;
  const ownerId = getAttr(root, 'NUMERO-IDENTIFICADOR') ?? '';
  if (ownerId && author.lattesId) return ownerId === author.lattesId;
  const dg = firstChild(root, 'DADOS-GERAIS');
  const ownerName = foldText((dg && getAttr(dg, 'NOME-COMPLETO')) ?? '');
  return ownerName !== '' && ownerName === foldText(author.name);
}

/** O registro que a mudança traz: o próprio item, ou o contêiner novo com um só. */
export function registryItem(el: XElement): XElement | undefined {
  if (REGISTRY_TYPES[el.name]) return el;
  if (el.name !== 'PRODUCAO-TECNICA') return undefined;
  const items = childElements(el).filter((c) => REGISTRY_TYPES[c.name]);
  return items.length === 1 && childElements(el).length === 1 ? items[0] : undefined;
}

/** Uma patente ou registro novo como inclusão; o motivo, quando vai à mão. */
export function planCreateRegistro(
  change: Change,
  chain: XElement[],
  item: XElement,
  label: string,
): Planned<CreateRegistroOp> {
  const type = REGISTRY_TYPES[item.name]!;
  const basics = childElements(item).find((c) => c.name.startsWith('DADOS-BASICOS-'));
  const detail = childElements(item).find((c) => c.name.startsWith('DETALHAMENTO-'));
  const registry = detail && firstChild(detail, 'REGISTRO-OU-PATENTE');
  const authors = readAuthors(item);
  if (authors.length > 1 || authors.some((a) => !isOwner(a, chain[0]))) {
    return { reason: 'Autores além de você ainda vão à mão: o conector não monta a grade' };
  }
  const extra = filledChildren(item, [basics?.name ?? '', detail?.name ?? '', 'AUTORES']);
  if (extra.length > 0) {
    return { reason: 'Palavras-chave, áreas, setores e informações adicionais ainda vão à mão' };
  }
  const dated = (registry?.attrs ?? []).some((a) => DATES.has(a.name) && a.value.trim());
  if (dated) {
    return {
      reason: `Datas do registro ainda vão à mão: ${type.dates === 'grade' ? GRID_DATES : FIELD_DATES}`,
    };
  }
  if (type.tipo === 'PP') {
    return {
      reason: `A patente vai à mão: o Lattes exige a data de depósito e o titular, e ${GRID_DATES}`,
    };
  }
  const set: FieldValues = {};
  const missing: string[] = [];
  const wrong: string[] = [];
  const map = (el: XElement | undefined, table: Record<string, [string, Mapper]>) => {
    for (const { name, value } of el?.attrs ?? []) {
      if (!value.trim() || SYSTEM.has(name)) continue;
      // Relevância "não" é o padrão; "sim" não tem campo no formulário do registro.
      if (name === 'FLAG-RELEVANCIA' && value === 'NAO') continue;
      let entry = table[name];
      if (name === 'TIPO-PATENTE') {
        const types = type.tipo === 'MR' ? BRAND_TYPES : PATENT_TYPES;
        entry = ['f_tipo', (v) => types[v]];
      }
      if (!entry || !type.fields.includes(entry[0])) {
        missing.push(labelOf(change, name));
        continue;
      }
      const mapped = entry[1](value);
      if (mapped === undefined || mapped === null)
        wrong.push(`${labelOf(change, name)} (${value})`);
      else set[entry[0]] = mapped;
    }
  };
  map(basics, BASICS);
  map(detail, DETAIL);
  map(registry, REGISTRY);
  const reason = reasonFrom(missing, wrong);
  if (reason) return { reason };
  if (!set.f_titulo || !set.f_cod_reg) {
    return { reason: 'O registro precisa do título (ou denominação) e do número' };
  }
  return { expect: {}, key: change.key, kind: 'criar-registro', label, set, tipo: type.tipo };
}

/**
 * O formulário de inclusão de um registro, na cultivar registrada (censo de
 * 15/10/2026): os campos que todos os tipos têm. O contrato confere esses e
 * não acusa os outros (`partial`).
 */
export const CREATE_REGISTRO_SPEC: FormSpec & { mode: string; partial: true } = {
  action: 'PKG_PATENTE_REGISTRO.FORM',
  fields: {
    f_autores_l: hidden,
    f_cod: hidden,
    f_cod_reg: text(16),
    f_cod_tipo: hidden,
    f_ctr: hidden,
    f_dados_grid_datas: hidden,
    f_inst: text(75),
    f_pais: select,
    f_seq: hidden,
    f_sta_inovacao: radio,
    f_tipo_privacidade: select,
    f_titulo: text(400),
    f_titulo_en: text(400),
  },
  mode: 'I',
  name: 'PKG_PATENTE_REGISTRO',
  partial: true,
};

// Registro no Lattes ---------------------------------------------------------------

const REGISTRO_FORM = 'PKG_PATENTE_REGISTRO';

const sameType = (l: LattesLink, tipo: string) =>
  (l.params.f_cod_tipo ?? '').toUpperCase() === tipo;

/** As linhas da lista: links do formulário com f_seq (inferido, como nas outras produções). */
const registryRows = (html: string, tipo: string) =>
  findLinks(html, 'PKG_PATENTE_REGISTRO.form').filter((l) => l.params.f_seq && sameType(l, tipo));

/**
 * O formulário de inclusão do tipo. Na patente, a lista abre a janela prévia
 * (infDadPat) e o conector abre o formulário pelo endereço que a janela usa,
 * sem f_ctr=R; nos outros, o link "Incluir novo item" da lista.
 */
export function registryInclusion(listHtml: string, tipo: string, cv: string): string | undefined {
  if (tipo === 'PP') return `pkg_patente_registro.form?f_sta_inovacao=&f_cod=${cv}&f_cod_tipo=PP`;
  return findLinks(listHtml, 'PKG_PATENTE_REGISTRO.form').find(
    (l) => !l.params.f_seq && sameType(l, tipo),
  )?.path;
}

/** A lista do tipo no menu: PKG_PATENTE_REGISTRO.LISTA com o f_cod_tipo. */
export const registryList = (menu: string, tipo: string) =>
  findLinks(menu, 'PKG_PATENTE_REGISTRO.LISTA').find((l) => sameType(l, tipo));

export async function applyCreateRegistro(op: CreateRegistroOp, port: LattesPort): Promise<Result> {
  const result = (status: OpResult['status'], detail: string): Result => ({
    detail,
    key: op.key,
    status,
  });
  try {
    const menu = await port.menuHtml();
    const lista = registryList(menu, op.tipo);
    const cv = lista?.params.f_cod ?? cvCodeFrom(menu);
    if (!lista || !cv) throw new Stop('erro', 'A lista deste registro não está no menu do Lattes');
    const listaHtml = await getChecked(port, lista.path);
    const before = registryRows(listaHtml, op.tipo);
    // Duplicata: o mesmo número já cadastrado (o que verifica_cadastrado
    // perguntaria ao servidor, seção 17).
    for (const row of before) {
      const { pairs } = await readPairs(port, row.path, REGISTRO_FORM);
      if (foldText(pairValue(pairs, 'f_cod_reg') ?? '') === foldText(op.set.f_cod_reg ?? '')) {
        return result('divergente', 'O Lattes já tem um registro com esse número');
      }
    }

    const inclusion = registryInclusion(listaHtml, op.tipo, cv);
    if (!inclusion) throw new Stop('erro', 'Inclusão não encontrada na lista do Lattes');
    const form = await readPairs(port, inclusion, REGISTRO_FORM);
    if (
      pairValue(form.pairs, 'f_ctr') !== 'I' ||
      (pairValue(form.pairs, 'f_cod_tipo') ?? '').toUpperCase() !== op.tipo
    ) {
      return result('erro', 'O formulário não é o de inclusão deste registro');
    }
    const absent = absentFields(form.controls, op.set);
    if (absent.length > 0) {
      return result(
        'erro',
        `O formulário deste registro não tem: ${absent.map((f) => CREATE_FIELD_LABELS[f] ?? f).join(', ')}`,
      );
    }
    const limit = overLimit(form.controls, op.set);
    if (limit) return result('erro', limit);
    const response = await port.post(
      CREATE_REGISTRO_SPEC.action,
      encodeLatin1Form(setPairs(form.pairs, op.set)),
    );
    if (isLogonPage(response)) return result('sessao', SESSION);

    try {
      const known = new Set(before.map((l) => l.params.f_seq));
      const created = registryRows(await getChecked(port, lista.path), op.tipo).filter(
        (l) => !known.has(l.params.f_seq),
      );
      if (created.length !== 1) {
        return maybeCreated(
          op.key,
          'O registro pode ter sido criado',
          `a lista mostra ${created.length} registros novos`,
        );
      }
      const seq = created[0]!.params.f_seq!;
      const assigned = { 'SEQUENCIA-PRODUCAO': seq };
      const saved = await readPairs(port, created[0]!.path, REGISTRO_FORM);
      const problem = readBackProblem(
        `Criado no Lattes (registro ${seq})`,
        false,
        readBack(saved, op.set),
      );
      if (problem) return { ...result('divergente', problem), assigned };
      return {
        ...result('conferido', `Criado e conferido no Lattes (registro ${seq})`),
        assigned,
      };
    } catch (err) {
      return maybeCreated(
        op.key,
        'O registro pode ter sido criado',
        `a conferência falhou (${err instanceof Error ? err.message : 'falha inesperada'})`,
      );
    }
  } catch (err) {
    if (err instanceof Stop) return result(err.status, err.message);
    return result('erro', err instanceof Error ? err.message : 'Falha inesperada');
  }
}
