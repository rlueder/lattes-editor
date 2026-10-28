// As buscas do Lattes na hora de gravar uma formação alterada (formacao-edit.ts):
// instituição, curso e agência, pelos mesmos GETs da inclusão
// (create-formacao.ts; docs/lattes_internals.md, seção 18). A formação
// complementar (edit-lists.ts) usa as mesmas buscas de instituição e curso, e
// o endereço profissional as dele (endereco-buscas.ts); resolveOpLookups junta
// as três para apply.ts. Nenhuma busca grava nada. O resultado são os ocultos que o seleciona(), o
// selecionar() e o atribuir() da página escreveriam; os campos desabilitados
// (f_inst, f_curso, f_nme_agencia) não vão, como num envio do navegador.

import type { LattesPort, ResultStatus } from './apply.ts';
import { institutionResults } from './create.ts';
import { courseName } from './create-formacao.ts';
import { getChecked, jsCalls, sameCode, selectEntries, Stop } from './create-shared.ts';
import { isListEditOp } from './edit-lists.ts';
import { resolveEnderecoLookups } from './endereco-buscas.ts';
import { encodeLatin1Form, type FormControl, type Pairs, pairValue } from './form.ts';
import type { FormacaoLookups, InstitutionSlot } from './formacao-edit.ts';
import type { BridgeOp, FieldValues } from './plan.ts';

/** Os ocultos de cada instituição: V vai no primeiro, as outras letras no segundo (seção 18). */
const SLOTS: Record<InstitutionSlot, { name?: string; other: string; outra: string; v: string }> = {
  dout: { other: 'f_cod_inst2_dout', outra: 'S', v: 'f_cod_inst_dout' },
  main: { name: 'f_inst_old', other: 'f_cod_inst2', outra: 'N', v: 'f_cod_inst' },
};

export type Resolved =
  | {
      /** O que a releitura espera, quando difere do enviado (o curso sem o código CAPES). */
      check: FieldValues;
      set: FieldValues;
    }
  | { detail: string; status: ResultStatus };

/** O código gravado num par de ocultos (com a letra), ou vazio. */
const codeIn = (pairs: Pairs, a: string, b: string) =>
  pairValue(pairs, a) || pairValue(pairs, b) || '';

/**
 * Os campos que as buscas dão, para juntar ao set da operação. `pairs` é o
 * formulário como veio, já conferido; dele saem o código do currículo, o nível
 * e a instituição atual (para a lista de cursos quando a instituição não muda).
 */
export async function resolveFormacao(
  lookups: FormacaoLookups,
  port: LattesPort,
  pairs: Pairs,
): Promise<Resolved> {
  try {
    return await resolve(lookups, port, pairs);
  } catch (err) {
    // A sessão que caiu no meio de uma busca para a fila como sessão.
    if (err instanceof Stop) return { detail: err.message, status: err.status };
    throw err;
  }
}

async function resolve(
  lookups: FormacaoLookups,
  port: LattesPort,
  pairs: Pairs,
): Promise<Resolved> {
  const cv = pairValue(pairs, 'f_cod') ?? '';
  const level = pairValue(pairs, 'f_nivel') ?? '';
  const set: FieldValues = {};
  const check: FieldValues = {};
  let institution = codeIn(pairs, 'f_cod_inst', 'f_cod_inst2');

  for (const inst of lookups.institutions ?? []) {
    const slot = SLOTS[inst.slot];
    const now = codeIn(pairs, slot.v, slot.other);
    if (inst.before ? !sameCode(now, inst.before) : now !== '') {
      return {
        detail: 'O Lattes não está como o editor espera: Instituição',
        status: 'divergente',
      };
    }
    const search = encodeLatin1Form([
      ['F_CTR', 'C'],
      ['F_COD', cv],
      ['F_NIVEL', level],
      ['F_STA_OUTRA', slot.outra],
      ['f_nome', inst.name],
    ]);
    const found = institutionResults(await getChecked(port, `PRC_INST_FORM?${search}`)).filter(
      (r) => sameCode(r.code, inst.code),
    );
    if (found.length !== 1) {
      return {
        detail: `Instituição não encontrada na busca do Lattes (${found.length} resultados com o código)`,
        status: 'erro',
      };
    }
    const hit = found[0]!;
    const v = hit.code.startsWith('V');
    set[slot.v] = v ? hit.code : '';
    set[slot.other] = v ? '' : hit.code;
    if (slot.name) set[slot.name] = hit.name;
    if (inst.slot === 'main') institution = hit.code;
  }

  if (lookups.course) {
    const courses = selectEntries(
      await getChecked(
        port,
        `prc_curso_form?f_cod=${cv}&f_pgm=FORM&f_nivel=${level}&f_inst=${institution}`,
      ),
      'f_curso',
    ).filter((o) => sameCode(o.value, lookups.course!));
    if (courses.length !== 1) {
      return {
        detail: `Curso não encontrado na lista do Lattes (${courses.length} achados)`,
        status: 'erro',
      };
    }
    const course = courses[0]!;
    // O curso vai sem a letra; o texto da opção traz o código CAPES, que o
    // Lattes não guarda (observado em 16/10/2026, create-formacao.ts).
    const v = course.value.startsWith('V');
    set.f_cod_curso = v ? course.value.slice(1) : '';
    set.f_cod_curso2 = v ? '' : course.value.slice(1);
    set.f_curso_old = course.text;
    check.f_curso_old = courseName(course.text);
  }

  if (lookups.agency !== undefined) {
    if (lookups.agency === '') set.f_agencia = '';
    else {
      const agencies = jsCalls(
        await getChecked(port, `prc_agencia?f_cod=${cv}`),
        'atribuir',
      ).filter((args) => sameCode(args[0], lookups.agency!));
      if (agencies.length !== 1) {
        return {
          detail: `Agência não encontrada na lista do Lattes (${agencies.length} achadas)`,
          status: 'erro',
        };
      }
      set.f_agencia = agencies[0]![0]!;
    }
  }
  return { check, set };
}

/** O que as buscas de uma operação acrescentam ao envio e à releitura (apply.ts). */
export interface OpLookups {
  /** O que a releitura espera nos pares, quando difere do enviado. */
  check: FieldValues;
  set: FieldValues;
  /** O texto que os campos desabilitados têm de mostrar na releitura. */
  shown: FieldValues;
  /** Ocultos enviados que a releitura não confere: a página os traz vazios. */
  unchecked: string[];
}

/**
 * As buscas de qualquer operação que as pede: formação, formação
 * complementar e endereço profissional. Sem busca, tudo vazio. `before` é o
 * formulário como veio, já conferido.
 */
export async function resolveOpLookups(
  op: BridgeOp,
  port: LattesPort,
  before: { controls: FormControl[]; pairs: Pairs },
): Promise<OpLookups | { detail: string; status: ResultStatus }> {
  const out: OpLookups = { check: {}, set: {}, shown: {}, unchecked: [] };
  const lookups = op.kind === 'formacao' ? op.lookups : isListEditOp(op) ? op.lookups : undefined;
  if (lookups) {
    const r = await resolveFormacao(lookups, port, before.pairs);
    if ('status' in r) return r;
    Object.assign(out.set, r.set);
    Object.assign(out.check, r.check);
    // Na formação complementar, instituição e curso desabilitados mostram a escolha.
    if (isListEditOp(op)) {
      if (r.set.f_inst_old) out.shown.f_inst = r.set.f_inst_old;
      if (r.set.f_curso_old) out.shown.f_curso = r.check.f_curso_old ?? r.set.f_curso_old;
    }
  }
  if (op.kind === 'endereco' && (op.institution || op.organ || op.clearOrgan)) {
    const r = await resolveEnderecoLookups(op, port, before.pairs, before.controls);
    if ('status' in r) return r;
    Object.assign(out.set, r.set);
    Object.assign(out.shown, r.shown);
    out.unchecked.push(...r.unchecked);
  }
  return out;
}
