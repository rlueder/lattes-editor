// Incluir uma patente ou um registro no Lattes pelo conector (LAT-57), atrás
// de CREATE_ITEMS_ENABLED (create.ts). Os seis tipos usam o mesmo formulário,
// PKG_PATENTE_REGISTRO.form com f_cod_tipo, POST para
// PKG_PATENTE_REGISTRO.FORM (docs/lattes_internals.md, seção 17). Os campos de
// cada tipo, com limites e opções, são os da captura do censo de 15/10/2026
// (docs/lattes-formularios/).
//
// Observado: o formulário de cada tipo, o nome dele, os ocultos, as opções; a
// lista de patentes no menu; os parâmetros do link de inclusão das listas
// (seção 17); o formato das datas (dd/mm/aaaa), a grade de datas da patente e
// o que o check() de cada tipo exige (recaptura de 15/10/2026, seção 21).
// Inferido até o teste acompanhado: a ligação de cada campo com o atributo do
// XML (o currículo de quem capturou não tem nenhum registro; o rótulo de cada
// campo é a pista), a lista de cada tipo no menu, a resposta do POST, o item
// novo aparecer na lista com um f_seq novo, e o servidor aceitar a patente
// sem a janela prévia e sem o f_ctr=R.
//
// A própria pessoa entra na grade de inventores (f_autores_l) pela linha dela
// no autorDP do menu, como o check() exige (author-grid.ts, seção 22). A
// patente vai à mão: o check() exige também o titular ou depositante, numa
// grade que vem de outro vetor do menu, de forma ainda não lida.
// Também ficam à mão: datas na marca e na topografia (não há campo de data na
// tela), autores além do dono, palavras-chave, áreas, setores e informações
// adicionais, e o que o formulário do tipo não tem.

import type { Change } from '../model/changes.ts';
import { foldText } from '../model/fold-text.ts';
import { childElements, firstChild, getAttr, type XElement } from '../model/xml.ts';
import type { LattesPort, OpResult } from './apply.ts';
import { NO_OWNER_NAME, type OwnerNames, ownerNamesOf } from './author-grid.ts';
import type { FormSpec } from './contract.ts';
import { CREATE_FIELD_LABELS } from './create-labels.ts';
import {
  EXTRA_PARTS,
  planRegistroExtras,
  registroCheck,
  type RegistroExtras,
  registroExtrasSet,
} from './create-registro-extras.ts';
import {
  ATTR_LABELS,
  DATE_FIELDS,
  formDate,
  INVENTORS_UNREAD,
  PATENT_BY_HAND,
  PATENT_DATE_CODES,
  patentDateGrid,
  registryInclusion,
  registryList,
  registryRows,
  REQUIRED_BY_TYPE,
  unknownLinks,
} from './create-registro-rules.ts';
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
import { cvCodeFrom, isLogonPage } from './lattes-html.ts';
import type { FieldValues } from './plan.ts';

export interface CreateRegistroOp {
  /** Nenhum valor anterior: o item não existe no Lattes. */
  expect: FieldValues;
  /** Autores, informações adicionais, grades e depositante (create-registro-extras.ts). */
  extras?: RegistroExtras;
  key: string;
  kind: 'criar-registro';
  label: string;
  /** O nome completo e as citações do currículo, para conferir a linha de autor do menu. */
  owner: OwnerNames;
  set: FieldValues;
  /** f_cod_tipo da lista e do formulário: PP patente, CP, CR, DI, MR, TC. */
  tipo: string;
}

interface RegistryType {
  /** Os campos visíveis do formulário do tipo (censo de 15/10/2026). */
  fields: string[];
  tipo: string;
}

/** Elemento do XML → tipo do registro (seção 17; censo de 15/10/2026). */
export const REGISTRY_TYPES: Record<string, RegistryType> = {
  'CULTIVAR-PROTEGIDA': {
    fields: ['f_titulo', 'f_ano', 'f_pais', 'f_inst', 'f_cod_reg', 'f_sta_inovacao', 'f_titulo_en'],
    tipo: 'CP',
  },
  'CULTIVAR-REGISTRADA': {
    fields: ['f_titulo', 'f_ano', 'f_pais', 'f_inst', 'f_cod_reg', 'f_sta_inovacao', 'f_titulo_en'],
    tipo: 'CR',
  },
  'DESENHO-INDUSTRIAL': {
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

const labelOf = (change: Change, attr: string) =>
  change.fields.find((f) => f.attr === attr)?.label ?? ATTR_LABELS[attr] ?? attr;

/** O registro que a mudança traz: o próprio item, ou o contêiner novo com um só. */
export function registryItem(el: XElement): XElement | undefined {
  if (REGISTRY_TYPES[el.name]) return el;
  if (el.name !== 'PRODUCAO-TECNICA') return undefined;
  const items = childElements(el).filter((c) => REGISTRY_TYPES[c.name]);
  return items.length === 1 && childElements(el).length === 1 ? items[0] : undefined;
}

/**
 * Os campos do formulário para uma patente ou registro novo, com as datas no
 * formato do Lattes; o motivo, quando algo não tem como ir. Não decide se a
 * inclusão vai: planCreateRegistro ainda para por causa da grade de autores.
 */
export function registroFields(
  change: Change,
  chain: XElement[],
  item: XElement,
): { reason: string } | { extras: RegistroExtras; set: FieldValues; tipo: string } {
  const type = REGISTRY_TYPES[item.name]!;
  const basics = childElements(item).find((c) => c.name.startsWith('DADOS-BASICOS-'));
  const detail = childElements(item).find((c) => c.name.startsWith('DETALHAMENTO-'));
  const registry = detail && firstChild(detail, 'REGISTRO-OU-PATENTE');
  const extra = filledChildren(item, [basics?.name ?? '', detail?.name ?? '', ...EXTRA_PARTS]);
  if (extra.length > 0) {
    return {
      reason: `Partes que o formulário de registro não tem: ${extra.map((c) => c.name).join(', ')}`,
    };
  }
  const depositor = (registry && getAttr(registry, 'NOME-DO-DEPOSITANTE')) ?? '';
  const extras = planRegistroExtras(item, chain[0], depositor);
  if ('reason' in extras) return extras;
  const set: FieldValues = {};
  const missing: string[] = [];
  const wrong: string[] = [];
  const grid: { code: string; date: string; label: string }[] = [];
  const dateFields = DATE_FIELDS[type.tipo];
  const map = (el: XElement | undefined, table: Record<string, [string, Mapper]>) => {
    for (const { name, value } of el?.attrs ?? []) {
      if (!value.trim() || SYSTEM.has(name)) continue;
      // O depositante vai pela grade dele (create-registro-extras.ts).
      if (name === 'NOME-DO-DEPOSITANTE') continue;
      // Relevância "não" é o padrão; "sim" não tem campo no formulário do registro.
      if (name === 'FLAG-RELEVANCIA' && value === 'NAO') continue;
      if (value === 'NAO_INFORMADO') continue;
      if (DATES.has(name)) {
        const date = formDate(value);
        if (!date) {
          wrong.push(`${labelOf(change, name)} (${value})`);
        } else if (type.tipo === 'PP' && PATENT_DATE_CODES[name]) {
          const [code, label] = PATENT_DATE_CODES[name];
          grid.push({ code, date, label });
        } else if (dateFields?.[name]) {
          set[dateFields[name]] = date;
        } else {
          // Marca e topografia: nenhum campo de data na tela (seção 21).
          missing.push(labelOf(change, name));
        }
        continue;
      }
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
  if (grid.length > 0) set.f_dados_grid_datas = patentDateGrid(grid);
  // check() de todos os tipos: título, número, instituição de registro e país.
  if (!set.f_titulo || !set.f_cod_reg || !set.f_inst || !set.f_pais) {
    return {
      reason: 'O Lattes exige título (ou denominação), número, instituição de registro e país',
    };
  }
  const lacking = (REQUIRED_BY_TYPE[type.tipo] ?? []).filter(([f]) => !set[f]).map(([, l]) => l);
  if (lacking.length > 0) return { reason: `O Lattes exige ${lacking.join(', ')}` };
  if (type.tipo === 'PP' && !grid.some((g) => g.code === '1' || g.code === '2')) {
    return { reason: 'O Lattes exige a data de depósito ou a de depósito PCT' };
  }
  return { extras, set, tipo: type.tipo };
}

/**
 * Uma patente ou registro novo como inclusão; o motivo, quando vai à mão. A
 * própria pessoa entra na grade de inventores pela linha dela no autorDP do
 * menu, na hora do envio (author-grid.ts). A patente vai à mão: o check()
 * exige também o titular ou depositante, cuja grade vem de outro vetor do menu
 * (titularPessoaDP), de forma ainda não lida.
 */
export function planCreateRegistro(
  change: Change,
  chain: XElement[],
  item: XElement,
  label: string,
): Planned<CreateRegistroOp> {
  const fields = registroFields(change, chain, item);
  if ('reason' in fields) return fields;
  // O check() da patente exige o depositante ou titular.
  if (fields.tipo === 'PP' && !fields.extras.depositor) return { reason: PATENT_BY_HAND };
  const owner = ownerNamesOf(chain[0]);
  if (!owner) return { reason: NO_OWNER_NAME };
  return { expect: {}, key: change.key, kind: 'criar-registro', label, owner, ...fields };
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
    const before = registryRows(listaHtml);
    const inclusion = registryInclusion(listaHtml, op.tipo, cv);
    if (!inclusion) throw new Stop('erro', 'Inclusão não encontrada na lista do Lattes');
    if (op.tipo !== 'PP' && unknownLinks(listaHtml, inclusion).length > 0) {
      throw new Stop(
        'erro',
        'A lista do Lattes tem linhas que o conector não reconhece; nada foi enviado',
      );
    }
    // Duplicata: o mesmo número já cadastrado (o que verifica_cadastrado
    // perguntaria ao servidor, seção 17). Cada linha precisa ser do tipo, pelo
    // oculto f_cod_tipo do formulário; uma de outro tipo para tudo.
    for (const row of before) {
      const { pairs } = await readPairs(port, row.path, REGISTRO_FORM);
      if ((pairValue(pairs, 'f_cod_tipo') ?? '').toUpperCase() !== op.tipo) {
        throw new Stop(
          'erro',
          'A lista do Lattes mostrou um registro de outro tipo; nada foi enviado',
        );
      }
      if (foldText(pairValue(pairs, 'f_cod_reg') ?? '') === foldText(op.set.f_cod_reg ?? '')) {
        return result('divergente', 'O Lattes já tem um registro com esse número');
      }
    }

    const form = await readPairs(port, inclusion, REGISTRO_FORM);
    if (
      pairValue(form.pairs, 'f_ctr') !== 'I' ||
      (pairValue(form.pairs, 'f_cod_tipo') ?? '').toUpperCase() !== op.tipo
    ) {
      return result('erro', 'O formulário não é o de inclusão deste registro');
    }
    // A grade de datas da patente vai num oculto, como o check() a monta (seção 21).
    const { f_dados_grid_datas: _grid, ...typed } = op.set;
    const absent = absentFields(form.controls, typed);
    // Os autores (a própria pessoa pela linha dela no autorDP, os outros pela
    // lista de autores do menu), as informações, as grades e o depositante.
    const extras = await registroExtrasSet(
      op.extras ?? { authors: [{ citation: '', cnpq: '', name: '', owner: true }] },
      op.owner,
      menu,
      port,
      form.pairs,
    );
    if ('status' in extras) return result(extras.status, extras.detail);
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
      encodeLatin1Form(setPairs(form.pairs, { ...op.set, ...extras.set })),
    );
    if (isLogonPage(response)) return result('sessao', SESSION);

    try {
      const known = new Set(before.map((l) => l.params.f_seq));
      const created = registryRows(await getChecked(port, lista.path)).filter(
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
      const check = await registroCheck(port, created[0]!.path, saved, op.set, op.extras);
      const problem = readBackProblem(`Criado no Lattes (registro ${seq})`, check);
      if (problem) return { ...result('divergente', problem), assigned };
      // A grade de autores volta no script da página, não num campo, e os
      // inventores ficam sem reler: o aviso vai no registro do enviado.
      return {
        ...result('conferido', `${INVENTORS_UNREAD} (registro ${seq})`),
        assigned,
        partial: true,
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

export { formDate, patentDateGrid };
