// A instituição e o órgão do endereço profissional pelas janelas de busca da
// página de endereço (GN_ENDERECO), lidas no Lattes real em 20/10/2026
// (docs/lattes_internals.md, seção 18, "Endereço profissional"). O plano
// (planEnderecoLookups) diz o que a mudança pede; na hora de gravar,
// resolveEnderecoLookups faz as buscas e devolve os ocultos que a página
// escreveria. Nenhuma busca grava nada. Atrás de COMPL_ENDERECO_LOOKUPS_ENABLED
// (edit-lists.ts), com a capacidade buscas-complementar-endereco.
//
// Observado: a busca de instituição posta o formulário instituicaoForm para
// PRC_INST_ATIV (F_CTR=C, F_COD, F_PGM vazio, F_MODAL_CV=1, f_nome), e a
// resposta traz seleciona('<código>','<nome>'); o seleciona() grava o nome em
// f_inst e f_inst_old e o código sem a letra, em f_cod_inst (letra V) ou
// f_cod_inst2 (as outras). O orgao() da página abre
// prc_orgao_cargo?f_cod=…&f_cod_inst=<V e f_cod_inst, ou D e f_cod_inst2>, a
// janela das atividades, cujo atribuir() grava f_orgao, f_orgao_old e
// f_codorgao (tipo 0) ou f_codorgao2.
//
// Inferido: que a página traga esses ocultos com o valor gravado e que
// PRC_ENDERECO os grave; que a janela pelo endereço das atividades
// (activityOrgansPath, com f_origem, f_modal_cv=9 e f_cod_inst2) liste os
// mesmos órgãos que a do endereço. Se o seleciona() limpa o órgão não foi
// visto: a instituição nova com órgão no item só vai com o órgão escolhido de
// novo. A unidade não tem campo próprio no formulário e fica à mão.
//
// Observado em 28/10/2026: ao trocar a instituição com órgão, o testa_inst()
// da página pergunta "Será necessário alterar o Órgão/Unidade" e limpa
// f_codorgao, f_codorgao2, f_orgao e f_orgao_old. A instituição nova sem
// órgão escolhido vai assim, com o órgão vazio.

import type { Change } from '../model/changes.ts';
import { getAttr, type XElement } from '../model/xml.ts';
import type { LattesPort, ResultStatus } from './apply.ts';
import { institutionResults } from './create.ts';
import { sameCode, SESSION } from './create-shared.ts';
import { encodeLatin1Form, type FormControl, type Pairs, pairValue } from './form.ts';
import type { LookupRow } from './formacao-edit.ts';
import { isLogonPage } from './lattes-html.ts';
import { activityOrgansPath } from './organ-windows.ts';
import type { FieldValues } from './plan.ts';
import { type OrganChoice, resolveOrgan } from './production/organ.ts';

/** A instituição nova do endereço profissional. */
export interface EnderecoInstitution {
  /** O código de antes, como o XML guarda; vazio quando não havia instituição. */
  before: string;
  /** O código novo, como o XML guarda (sem a letra). */
  code: string;
  /** O nome novo, que vai na busca. */
  name: string;
}

/** O que a mudança no endereço profissional pede às buscas. */
export interface EnderecoLookups {
  /** O órgão de antes sai com a instituição nova, como o testa_inst() da página faz. */
  clearOrgan?: boolean;
  institution?: EnderecoInstitution;
  organ?: OrganChoice;
  rows: LookupRow[];
}

const INSTITUTION = { code: 'CODIGO-INSTITUICAO-EMPRESA', name: 'NOME-INSTITUICAO-EMPRESA' };
const ORGAN = { code: 'CODIGO-ORGAO', name: 'NOME-ORGAO' };
const UNIT = ['CODIGO-UNIDADE', 'NOME-UNIDADE'];

/** Os atributos que vão pelas buscas, e não por um campo do formulário. */
export const ENDERECO_LOOKUP_ATTRS = new Set([
  INSTITUTION.code,
  INSTITUTION.name,
  ORGAN.code,
  ORGAN.name,
]);

const PICK =
  'A instituição só muda pela busca do Lattes, que grava o código e o nome juntos: escolha a instituição pela busca';

/**
 * A instituição e o órgão novos de uma mudança no endereço profissional;
 * undefined quando ela não troca nenhum dos dois.
 */
export function planEnderecoLookups(
  change: Change,
  el: XElement,
): EnderecoLookups | { reason: string } | undefined {
  const field = (attr: string) => change.fields.find((f) => f.attr === attr);
  const touched = (a: { code: string; name: string }) => field(a.code) ?? field(a.name);
  if (!touched(INSTITUTION) && !touched(ORGAN)) return undefined;
  const now = (attr: string) => getAttr(el, attr) ?? '';
  const was = (attr: string) => field(attr)?.before ?? now(attr);
  const out: EnderecoLookups = { rows: [] };

  // A instituição nova com o órgão vazio: o que o testa_inst() da página faz.
  const cleared =
    Boolean(touched(INSTITUTION)) && [ORGAN.code, ORGAN.name, ...UNIT].every((a) => now(a) === '');
  if (touched(ORGAN) && !cleared) {
    if (now(ORGAN.code) === was(ORGAN.code)) {
      return { reason: 'Órgão: escolha pela lista do Lattes, que grava o código junto' };
    }
    if (!now(ORGAN.code)) {
      return {
        reason: 'O órgão do endereço profissional não fica vazio pelo conector; troque no Lattes',
      };
    }
    if (UNIT.some((a) => now(a) !== '')) {
      return {
        reason:
          'Com unidade no endereço profissional, o órgão novo pede a unidade dele, que o formulário de endereço não tem: troque no Lattes',
      };
    }
    out.organ = { before: was(ORGAN.code), beforeText: was(ORGAN.name), code: now(ORGAN.code) };
    out.rows.push({
      after: now(ORGAN.name),
      before: was(ORGAN.name),
      label: field(ORGAN.name)?.label ?? 'Órgão',
      name: ORGAN.code,
    });
  }

  if (touched(INSTITUTION)) {
    const code = now(INSTITUTION.code);
    const name = now(INSTITUTION.name);
    if (code === was(INSTITUTION.code)) return { reason: PICK };
    if (!code || !name) {
      return { reason: 'Instituição sem código do Lattes: escolha pela busca de instituições' };
    }
    // O órgão de antes é da outra instituição: só vai com o órgão novo.
    const organ = [ORGAN.code, ORGAN.name, ...UNIT].some((a) => now(a) !== '');
    if (organ && !out.organ) {
      return {
        reason:
          'Com órgão no endereço profissional, a instituição nova pede o órgão dela: escolha o órgão de novo, ou troque os dois no Lattes',
      };
    }
    // O banco do Lattes exige, com a instituição, o país e, no Brasil, a
    // cidade e a UF (ORA-20001, observado em 28/10/2026).
    const brazil = now('PAIS') === 'Brasil';
    if (!now('PAIS') || (brazil && (!now('CIDADE') || !now('UF')))) {
      return {
        reason:
          'Com instituição, o Lattes exige no endereço profissional o país e, no Brasil, a cidade e a UF',
      };
    }
    out.institution = { before: was(INSTITUTION.code), code, name };
    if (cleared && was(ORGAN.name)) {
      out.clearOrgan = true;
      out.rows.push({ after: '', before: was(ORGAN.name), label: 'Órgão', name: ORGAN.code });
    }
    out.rows.unshift({
      after: name,
      before: was(INSTITUTION.name),
      label: field(INSTITUTION.name)?.label ?? 'Instituição',
      name: INSTITUTION.code,
    });
  }
  return out;
}

export type EnderecoResolved =
  | {
      set: FieldValues;
      /** O texto que os campos desabilitados (f_inst, f_orgao) têm de mostrar na releitura. */
      shown: FieldValues;
      /** Ocultos enviados que a releitura não confere (a página os traz vazios). */
      unchecked: string[];
    }
  | { detail: string; status: ResultStatus };

/** O código gravado num par de ocultos, ou vazio. */
const codeIn = (pairs: Pairs) =>
  pairValue(pairs, 'f_cod_inst') || pairValue(pairs, 'f_cod_inst2') || '';

/**
 * As buscas do endereço na hora de gravar: a instituição por PRC_INST_ATIV,
 * depois o órgão pela janela de órgãos da instituição (a nova, quando muda).
 * `pairs` e `controls` são o formulário como veio, já conferido.
 */
export async function resolveEnderecoLookups(
  op: { clearOrgan?: boolean; institution?: EnderecoInstitution; organ?: OrganChoice },
  port: LattesPort,
  pairs: Pairs,
  controls: FormControl[],
): Promise<EnderecoResolved> {
  const set: FieldValues = {};
  const shown: FieldValues = {};
  const unchecked: string[] = [];
  let windowInstitution = '';

  if (op.institution) {
    const want = op.institution;
    const now = codeIn(pairs);
    if (want.before ? !sameCode(now, want.before) : now !== '') {
      return {
        detail: 'O Lattes não está como o editor espera: Instituição',
        status: 'divergente',
      };
    }
    const page = await port.post(
      'PRC_INST_ATIV',
      encodeLatin1Form([
        ['F_CTR', 'C'],
        ['F_COD', pairValue(pairs, 'f_cod') ?? ''],
        ['F_PGM', ''],
        ['F_MODAL_CV', '1'],
        ['f_nome', want.name],
      ]),
    );
    if (isLogonPage(page)) return { detail: SESSION, status: 'sessao' };
    const found = institutionResults(page).filter((r) => sameCode(r.code, want.code));
    if (found.length !== 1) {
      return {
        detail: `Instituição não encontrada na busca do Lattes (${found.length} resultados com o código)`,
        status: 'erro',
      };
    }
    const hit = found[0]!;
    const bare = hit.code.slice(1);
    const v = hit.code.startsWith('V');
    Object.assign(set, {
      f_cod_inst: v ? bare : '',
      f_cod_inst2: v ? '' : bare,
      f_inst_old: hit.name,
    });
    shown.f_inst = hit.name;
    // A janela de órgãos com a instituição nova, como o orgao() da página a montaria.
    windowInstitution = `${v ? 'V' : 'D'}${bare}`;
  }

  if (op.clearOrgan) {
    // f_orgao vem desabilitado: a página não o manda, e a releitura confere o texto.
    Object.assign(set, { f_codorgao: '', f_codorgao2: '', f_orgao_old: '' });
    shown.f_orgao = '';
  }
  if (op.organ) {
    const text = controls.find((c) => c.name === 'f_orgao')?.value ?? '';
    const resolved = await resolveOrgan(op.organ, port, pairs, text, {
      institution: windowInstitution,
      path: activityOrgansPath,
    });
    if ('status' in resolved) return resolved;
    Object.assign(set, resolved.set);
    unchecked.push(...Object.keys(resolved.check));
    if (resolved.shown !== undefined) shown.f_orgao = resolved.shown;
  }
  return { set, shown, unchecked };
}
