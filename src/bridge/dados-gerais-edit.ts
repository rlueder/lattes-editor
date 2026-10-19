// Identificação, endereço e outras informações relevantes pelo conector
// (LAT-23, LAT-58): que atributo do XML vai em que campo de GN_IDENT,
// GN_ENDERECO e GN_OUTRA_INF_RELEV, e o porquê do que fica à mão. Os campos,
// os tipos e as opções são os do censo de 15/10/2026
// (docs/lattes-formularios/); biographic.ts acha o formulário e apply.ts
// confere e grava.
//
// Observado na passada de edição do censo (ligação pelo valor): f_nome_citacao
// ↔ NOME-EM-CITACOES-BIBLIOGRAFICAS, f_cidade_nasc, f_uf_nasc ↔ UF-NASCIMENTO,
// f_uf_rg ↔ UF-ORGAO-EMISSOR, f_rg_nro, f_orgao_rg, f_pais_nacio ↔
// SIGLA-PAIS-NACIONALIDADE, f_pais_nasc ↔ PAIS-DE-NASCIMENTO (pelo código do
// país), f_sexo M ↔ MASCULINO, f_pais_r ↔ PAIS do residencial e f_end_corr R
// ↔ ENDERECO_RESIDENCIAL.
//
// Inferido, até o teste acompanhado:
// - f_sexo F ↔ FEMININO e f_end_corr I ↔ ENDERECO_INSTITUCIONAL (a outra opção);
// - f_passaporte ↔ NUMERO-DO-PASSAPORTE (nome e rótulo);
// - f_dta_nasc e f_dta_rg com a data em DD/MM/AAAA (campos de 10 caracteres);
//   a conferência do "antes" acusa se o Lattes guardar de outro jeito;
// - fnro_id_raca_cor pelo rótulo da opção (Branca, Preta…): nenhuma exportação
//   com RACA-OU-COR preenchida foi vista;
// - f_nacionalidade B quando o país de nacionalidade é o Brasil e E nos outros
//   casos, como a página faz por script (seção 5 de docs/lattes_internals.md);
// - f_pais_i ↔ PAIS do profissional, como o do residencial;
// - F_TEXTO de GN_OUTRA_INF_RELEV ↔ OUTRAS-INFORMACOES-RELEVANTES do elemento
//   de mesmo nome (o censo ligou o formulário ao elemento só pelo nome).
// - o envio do nome em citações pelos ocultos f_nome_citacao e
//   f_nome_citacao_h: os dois traziam o valor do XML no censo, mas a página os
//   monta por script, que não foi lido. Vão os dois com o valor novo; só um
//   deixaria o outro mudar ou não na releitura sem que se saiba qual vale.

import type { Change } from '../model/changes.ts';
import { parseEmails, parseSocial } from '../model/contacts.ts';
import { foldText } from '../model/fold-text.ts';
import { getAttr, type XElement } from '../model/xml.ts';
import listas from '../schema/listas-lattes.json' with { type: 'json' };
import { countryCode } from './edit-items.ts';
import { MAX_SOCIAL, type SocialRow } from './endereco-contatos.ts';
import type { FieldValues, OpBase } from './plan.ts';

/** Endereço: um formulário só para o profissional (_i) e o residencial (_r). */
export interface EnderecoOp extends OpBase {
  kind: 'endereco';
  /** As redes sociais antes e depois, quando a mudança é delas (endereco-contatos.ts). */
  social?: { after: SocialRow[]; before: SocialRow[] };
}

export interface IdentificacaoOp extends OpBase {
  kind: 'identificacao';
}

/** Outras informações relevantes: um formulário com um texto só. */
export interface OutrasInformacoesOp extends OpBase {
  kind: 'outras-informacoes';
}

type Planned<T> = T | { reason: string };
type Mapper = (value: string) => string | null | undefined;
const same: Mapper = (v) => v;

const UFS = new Set(listas.ufs);
const uf: Mapper = (v) => (v === '' || UFS.has(v) ? v : undefined);

/** País pelo nome, como o XML guarda, no código da lista do Lattes. */
const country: Mapper = (v) => (v ? countryCode(v) : '');

/** Data DDMMAAAA do XML como o campo de 10 caracteres a mostra (inferido). */
const date: Mapper = (v) => {
  if (v === '') return '';
  const m = /^(\d{2})(\d{2})(\d{4})$/.exec(v);
  return m ? `${m[1]}/${m[2]}/${m[3]}` : undefined;
};

/** SEXO → rádio f_sexo; vazio é nenhum rádio marcado. */
const sex: Mapper = (v) =>
  v === 'MASCULINO' ? 'M' : v === 'FEMININO' ? 'F' : v ? undefined : null;

/** Cor ou raça pelo rótulo da opção de fnro_id_raca_cor (censo de 15/10/2026). */
const RACE: Record<string, string> = {
  amarela: '5',
  branca: '1',
  indigena: '4',
  'nao desejo declarar': '6',
  parda: '3',
  preta: '2',
};
const race: Mapper = (v) =>
  v === '' ? '' : RACE[foldText(v.replace(/_/g, ' ').trim()).toLowerCase()];

/** Atributo de DADOS-GERAIS → campo de GN_IDENT. */
const IDENT_FIELDS: Record<string, [string, Mapper]> = {
  'CIDADE-NASCIMENTO': ['f_cidade_nasc', same],
  'DATA-DE-EMISSAO': ['f_dta_rg', date],
  'DATA-NASCIMENTO': ['f_dta_nasc', date],
  'NOME-COMPLETO': ['f_nome', same],
  'NOME-EM-CITACOES-BIBLIOGRAFICAS': ['f_nome_citacao', same],
  'NUMERO-DO-PASSAPORTE': ['f_passaporte', same],
  'NUMERO-IDENTIDADE': ['f_rg_nro', same],
  'ORGAO-EMISSOR': ['f_orgao_rg', same],
  'PAIS-DE-NASCIMENTO': ['f_pais_nasc', country],
  'RACA-OU-COR': ['fnro_id_raca_cor', race],
  SEXO: ['f_sexo', sex],
  'UF-NASCIMENTO': ['f_uf_nasc', uf],
  'UF-ORGAO-EMISSOR': ['f_uf_rg', uf],
};

/** Atributos que não estão no formulário de identificação (censo de 15/10/2026). */
const IDENT_ABSENT = new Set([
  'DATA-FALECIMENTO',
  'FORMATO-DATA-DE-EMISSAO',
  'FORMATO-DATA-DE-NASCIMENTO',
  'NOME-DO-ARQUIVO-DE-FOTO',
  'ORCID-ID',
  'OUTRAS-INFORMACOES-RELEVANTES',
  'PERMISSAO-DE-DIVULGACAO',
  'TEXTO-RESUMO-CV-RH',
]);

/** Atributos que o formulário traz só em campo oculto: a página não deixa alterá-los. */
const IDENT_HIDDEN = new Set(['CPF', 'NOME-DA-MAE', 'NOME-DO-PAI']);

const NATIONALITY = ['NACIONALIDADE', 'PAIS-DE-NACIONALIDADE', 'SIGLA-PAIS-NACIONALIDADE'];

/** Os campos com o "antes" vazio como nenhum rádio marcado. */
const RADIOS = new Set(['f_end_corr', 'f_sexo']);

/** Campos simples de uma tabela: set e expect, ou as listas do que não deu. */
function mapTable(
  change: Change,
  table: Record<string, [string, Mapper]>,
  suffix = '',
  skip: (attr: string) => boolean = () => false,
) {
  const set: FieldValues = {};
  const expect: FieldValues = {};
  const missing: string[] = [];
  const invalid: string[] = [];
  for (const f of change.fields) {
    if (skip(f.attr)) continue;
    const entry = table[f.attr];
    if (!entry) {
      missing.push(f.label);
      continue;
    }
    const field = `${entry[0]}${suffix}`;
    if (field in set) {
      // Dois atributos no mesmo campo: um sobrescreveria o outro sem aviso.
      missing.push(f.label);
      continue;
    }
    const after = entry[1](f.after);
    const before = RADIOS.has(entry[0]) && f.before === '' ? null : entry[1](f.before);
    if (after === undefined || before === undefined) {
      invalid.push(f.label);
      continue;
    }
    set[field] = after;
    expect[field] = before;
  }
  return { expect, invalid, missing, set };
}

const labelsOf = (change: Change, attrs: ReadonlySet<string>) =>
  change.fields.filter((f) => attrs.has(f.attr)).map((f) => f.label);

/** País de nacionalidade e nacionalidade, que a página liga por script. */
function planNationality(
  change: Change,
  el: XElement,
  set: FieldValues,
  expect: FieldValues,
): { reason: string } | undefined {
  const field = (attr: string) => change.fields.find((f) => f.attr === attr);
  const before = (attr: string) => field(attr)?.before ?? getAttr(el, attr) ?? '';
  const after = (attr: string) => getAttr(el, attr) ?? '';
  // O oculto f_nacionalidade recebe B ou E pelo JavaScript da página (seção
  // 5). Se o GET o trouxer vazio, o envio direto o mandaria vazio e apagaria
  // a nacionalidade: o "antes" tem de trazer o valor do XML, e sem B ou E no
  // XML não há com o que conferir, então segue à mão.
  const nationality = before('NACIONALIDADE');
  if (nationality !== 'B' && nationality !== 'E') {
    return { reason: 'Nacionalidade sem código B ou E no XML: não dá para conferir' };
  }
  expect.f_nacionalidade = nationality;
  const byName = field('PAIS-DE-NACIONALIDADE');
  const byCode = field('SIGLA-PAIS-NACIONALIDADE');
  if (!byName && !byCode) {
    return field('NACIONALIDADE')
      ? { reason: 'A nacionalidade segue o país de nacionalidade no Lattes: troque o país' }
      : undefined;
  }
  const code = byCode ? after('SIGLA-PAIS-NACIONALIDADE') : country(after('PAIS-DE-NACIONALIDADE'));
  if (byName && byCode && country(after('PAIS-DE-NACIONALIDADE')) !== code) {
    return { reason: 'O país de nacionalidade e a sigla do país não são o mesmo país' };
  }
  const known = new Set(Object.values(listas.codigosDosPaises));
  if (!code || !known.has(code)) {
    return {
      reason: `País de nacionalidade que o Lattes não tem: ${(byCode ? after('SIGLA-PAIS-NACIONALIDADE') : after('PAIS-DE-NACIONALIDADE')) || 'vazio'}`,
    };
  }
  const was = before('SIGLA-PAIS-NACIONALIDADE') || country(before('PAIS-DE-NACIONALIDADE'));
  if (!was) return { reason: 'O país de nacionalidade de antes não tem código no Lattes' };
  const next = code === 'BRA' ? 'B' : 'E';
  if (field('NACIONALIDADE') && after('NACIONALIDADE') !== next) {
    return {
      reason:
        'A nacionalidade segue o país de nacionalidade no Lattes: B para o Brasil, E para os outros',
    };
  }
  set.f_pais_nacio = code;
  expect.f_pais_nacio = was;
  set.f_nacionalidade = next;
  return undefined;
}

export function planIdentificacaoEdit(
  change: Change,
  el: XElement,
  label: string,
): Planned<IdentificacaoOp> {
  const absent = labelsOf(change, IDENT_ABSENT);
  if (absent.length > 0) {
    return { reason: `O formulário de identificação do Lattes não tem: ${absent.join(', ')}` };
  }
  const hidden = labelsOf(change, IDENT_HIDDEN);
  if (hidden.length > 0) {
    return {
      reason: `O formulário de identificação do Lattes não deixa alterar: ${hidden.join(', ')} (o campo é oculto na página)`,
    };
  }
  if (change.fields.some((f) => f.attr === 'PCD')) {
    return {
      reason:
        'Pessoa com deficiência: o formulário tem uma caixa por tipo e um oculto de mesmo nome, e como a exportação grava os tipos marcados não foi visto',
    };
  }
  const { expect, invalid, missing, set } = mapTable(change, IDENT_FIELDS, '', (a) =>
    NATIONALITY.includes(a),
  );
  if (missing.length) return { reason: `Campos não suportados ainda: ${missing.join(', ')}` };
  if (invalid.length) {
    return {
      reason: `Valor que o formulário de identificação do Lattes não tem: ${invalid.join(', ')}`,
    };
  }
  if (set.f_nome !== undefined && !set.f_nome?.trim()) {
    return { reason: 'O Lattes não aceita o nome completo vazio' };
  }
  if ('f_nome_citacao' in set) {
    set.f_nome_citacao_h = set.f_nome_citacao!;
    expect.f_nome_citacao_h = expect.f_nome_citacao!;
  }
  const nationality = planNationality(change, el, set, expect);
  if (nationality) return nationality;
  return { expect, key: change.key, kind: 'identificacao', label, set };
}

// ---------------------------------------------------------------- endereço

/**
 * Atributo comum a ENDERECO-PROFISSIONAL e ENDERECO-RESIDENCIAL → campo, sem
 * o sufixo. O logradouro tem um nome em cada elemento (XSD) e entra por
 * ENDERECO_STREET, para nenhum dos dois cair no logradouro do outro.
 */
const ENDERECO_FIELDS: Record<string, [string, Mapper]> = {
  BAIRRO: ['f_bairro', same],
  'CAIXA-POSTAL': ['f_caixa', same],
  CEP: ['f_cep', same],
  CIDADE: ['f_munic', same],
  DDD: ['f_ddd', same],
  'E-MAIL': ['f_email', same],
  FAX: ['f_fax', same],
  'HOME-PAGE': ['f_homepage', same],
  PAIS: ['f_pais', country],
  RAMAL: ['f_ramal', same],
  TELEFONE: ['f_fone', same],
  UF: ['f_estado', same],
};

export const ENDERECO_SUFFIX: Record<string, string> = {
  'ENDERECO-PROFISSIONAL': '_i',
  'ENDERECO-RESIDENCIAL': '_r',
};

const ENDERECO_STREET: Record<string, string> = {
  'ENDERECO-PROFISSIONAL': 'LOGRADOURO-COMPLEMENTO',
  'ENDERECO-RESIDENCIAL': 'LOGRADOURO',
};

/** A instituição do endereço profissional: campos desabilitados, só pela busca. */
const PROFESSIONAL_LOOKUP = new Set([
  'CODIGO-INSTITUICAO-EMPRESA',
  'CODIGO-ORGAO',
  'NOME-INSTITUICAO-EMPRESA',
  'NOME-ORGAO',
]);
const PROFESSIONAL_ABSENT = new Set(['CODIGO-UNIDADE', 'NOME-UNIDADE']);

/** ENDERECO@FLAG-DE-PREFERENCIA → rádio f_end_corr; o resto do ENDERECO vai em grades. */
const PREFERENCE: Record<string, [string, Mapper]> = {
  'FLAG-DE-PREFERENCIA': [
    'f_end_corr',
    (v) =>
      v === 'ENDERECO_RESIDENCIAL'
        ? 'R'
        : v === 'ENDERECO_INSTITUCIONAL'
          ? 'I'
          : v
            ? undefined
            : null,
  ],
};
const CONTACTS = new Set(['ELETRONICO', 'OUTRA-FORMA-DE-CONTATO', 'REDE-SOCIAL']);

/**
 * Os contatos do ENDERECO (contacts.ts no editor): e-mails em ELETRONICO
 * ("I: …" para contato, "R: …" alternativo, o R inferido pelo sufixo do
 * campo), redes em REDE-SOCIAL. As outras formas de contato ficam à mão: a
 * exportação nunca foi vista com uma.
 */
function planContacts(change: Change): {
  expect: FieldValues;
  reason?: string;
  set: FieldValues;
  social?: EnderecoOp['social'];
} {
  const set: FieldValues = {};
  const expect: FieldValues = {};
  let social: EnderecoOp['social'];
  for (const f of change.fields) {
    if (f.attr === 'OUTRA-FORMA-DE-CONTATO') {
      return {
        expect,
        reason:
          'Outra forma de contato: a exportação do Lattes nunca foi vista com uma, e o conector não sabe como ela volta; altere no Lattes',
        set,
      };
    }
    if (f.attr === 'ELETRONICO') {
      const of = (v: string) => {
        const all = parseEmails(v);
        const pick = (a: string) => all.find((e) => e.address === a)?.email ?? '';
        return { i: pick('E-mail para contato'), n: all.length, r: pick('E-mail alternativo') };
      };
      const [was, now] = [of(f.before), of(f.after)];
      if (now.n !== (now.i ? 1 : 0) + (now.r ? 1 : 0)) {
        return {
          expect,
          reason: 'E-mails: cada um precisa dizer se é para contato (I:) ou alternativo (R:)',
          set,
        };
      }
      Object.assign(set, { f_email_i: now.i, f_email_r: now.r });
      Object.assign(expect, { f_email_i: was.i, f_email_r: was.r });
    }
    if (f.attr === 'REDE-SOCIAL') {
      const before = parseSocial(f.before).map((r) => ({ name: r.name, url: r.url }));
      const after = parseSocial(f.after).map((r) => ({ name: r.name, url: r.url }));
      if (f.after.trim() && after.length === 0) {
        return { expect, reason: 'Redes sociais: o texto não está no formato do Lattes', set };
      }
      if (after.length > MAX_SOCIAL) {
        return { expect, reason: `O Lattes aceita até ${MAX_SOCIAL} redes sociais`, set };
      }
      social = { after, before };
    }
  }
  return { expect, set, ...(social ? { social } : {}) };
}

export function planEnderecoEdit(
  change: Change,
  element: string,
  label: string,
): Planned<EnderecoOp> {
  if (element === 'ENDERECO' && change.fields.some((f) => CONTACTS.has(f.attr))) {
    const contacts = planContacts(change);
    if (contacts.reason) return { reason: contacts.reason };
    const rest = { ...change, fields: change.fields.filter((f) => !CONTACTS.has(f.attr)) };
    const others = rest.fields.length > 0 ? planEnderecoEdit(rest, element, label) : undefined;
    if (others && 'reason' in others) return others;
    return {
      expect: { ...(others?.expect ?? {}), ...contacts.expect },
      key: change.key,
      kind: 'endereco',
      label,
      set: { ...(others?.set ?? {}), ...contacts.set },
      ...(contacts.social ? { social: contacts.social } : {}),
    };
  }
  if (labelsOf(change, PROFESSIONAL_LOOKUP).length > 0) {
    return {
      reason:
        'A instituição e o órgão do endereço profissional só se escolhem pela busca do Lattes (campos desabilitados no formulário de endereço), que o conector ainda não faz nesse formulário',
    };
  }
  const unit = labelsOf(change, PROFESSIONAL_ABSENT);
  if (unit.length > 0) {
    return {
      reason: `O formulário de endereço do Lattes não tem campo próprio para: ${unit.join(', ')}`,
    };
  }
  const table =
    element === 'ENDERECO'
      ? PREFERENCE
      : { ...ENDERECO_FIELDS, [ENDERECO_STREET[element]!]: ['f_rua', same] as [string, Mapper] };
  const { expect, invalid, missing, set } = mapTable(change, table, ENDERECO_SUFFIX[element] ?? '');
  if (missing.length) return { reason: `Campos não suportados ainda: ${missing.join(', ')}` };
  if (invalid.length) {
    return {
      reason: `Valor que o formulário de endereço do Lattes não tem: ${invalid.join(', ')}`,
    };
  }
  return { expect, key: change.key, kind: 'endereco', label, set };
}

// ---------------------------------------------------------------- outros

export function planOutrasInformacoes(change: Change, label: string): Planned<OutrasInformacoesOp> {
  const { expect, missing, set } = mapTable(change, {
    'OUTRAS-INFORMACOES-RELEVANTES': ['F_TEXTO', same],
  });
  if (missing.length) return { reason: `Campos não suportados ainda: ${missing.join(', ')}` };
  return { expect, key: change.key, kind: 'outras-informacoes', label, set };
}

/** CURRICULO-VITAE: só dados que o Lattes gera na exportação. */
export const CURRICULO_REASON =
  'Dados que o próprio Lattes gera na exportação (sistema de origem, identificador, data e hora da atualização): não há formulário para eles';
