// Quanto do editor o conector consegue enviar ao Lattes. Para cada atributo
// de cada elemento de um currículo, troca o valor numa cópia, planeja o envio
// com todas as funções do conector ligadas e anota o que vira operação e o
// que fica à mão, com o motivo. Uso:
//
//   node scripts/cobertura-conector.ts [arquivo.xml] [--so=ELEMENTO,...] [--resumo] [--lista=TIPO-DE-ITEM]
//   node scripts/cobertura-conector.ts --por-curriculo [arquivo.xml] [--so=ELEMENTO,...]
//
// O padrão conta campos: cada campo do editor (o caminho do elemento no XML e
// o atributo) uma vez só, de fixtures/synthetic_full.xml (que tem todos os
// elementos do schema) ou do arquivo dado. Um campo vai pelo conector quando
// toda troca nele vira envio. O Lattes não o tem quando nenhuma troca vai e
// todas dão só motivos de campo ausente (o mesmo fieldAbsent que o editor
// usa): fica só para ler no editor. O resto falta no conector, inclusive o
// campo em que parte das trocas vai. --resumo mostra só os totais;
// --lista=MESTRADO lista os campos que faltam num tipo de item, com o motivo,
// e --lista=motivo:Valor os que faltam por um motivo que começa assim.
//
// --por-curriculo é a contagem antiga, por troca de atributo num currículo
// (fixtures/demo.xml e fixtures/synthetic_full.xml sem arquivo): depende de
// quantos itens de cada tipo o exemplo tem. A troca é sintética (outro valor do
// enumerado, o ano anterior, o texto com " x"), e por isso um motivo do tipo
// "valor sem correspondência" pode ser da troca e não do conector. Onde o
// editor oferece a lista do Lattes (instituição, curso, agência), a troca é a
// escolha nela, com código e nome juntos, como a pessoa faria: trocar só o
// nome é o caso que o planejador recusa de propósito.

import { readFileSync } from 'node:fs';

import { BRIDGE_FEATURES } from '../src/bridge/compat.ts';
import { fieldAbsent } from '../src/bridge/form-lacks.ts';
import { planChanges, planOptionsFor } from '../src/bridge/plan.ts';
import { diffDocuments } from '../src/model/changes.ts';
import { applyLinkedAttrs, followsCountry } from '../src/model/linked-attrs.ts';
import { getAttr, parseXml, serializeXml, setAttr, type XElement } from '../src/model/xml.ts';
import { lattesSchema } from '../src/schema/lattes.ts';
import { derivedValue, outOfList, typedChoices } from '../src/schema/typed-choices.ts';
import { isSystemAttr } from '../src/ui/field-kind.ts';
import {
  ancestorsOf,
  applyAgency,
  applyCourse,
  applyInstitution,
  applyOrgan,
  applyUnit,
  courseAttrs,
  liveKind,
} from '../src/ui/live-lists.ts';

const args = process.argv.slice(2);
const named = args.find((a) => !a.startsWith('--'));
const files = named ? [named] : ['fixtures/demo.xml', 'fixtures/synthetic_full.xml'];
const summaryOnly = args.includes('--resumo');
const byCv = args.includes('--por-curriculo');
const only = args
  .find((a) => a.startsWith('--so='))
  ?.slice(5)
  .split(',');
const options = planOptionsFor([...BRIDGE_FEATURES]);

const flatten = (root: XElement): XElement[] => {
  const out: XElement[] = [];
  const walk = (e: XElement) => {
    out.push(e);
    for (const c of e.children) if (c.kind === 'element') walk(c);
  };
  walk(root);
  return out;
};

/** Outro valor para o atributo, do tipo dele; país e idioma, um que o Lattes tem. */
function changed(attr: string, value: string, choices: string[] | undefined): string {
  if (choices) return choices.find((v) => v !== value) ?? 'X';
  if (/^PAIS|-PAIS$|^PAIS-/.test(attr)) return value === 'Argentina' ? 'Brasil' : 'Argentina';
  if (/^IDIOMA$/.test(attr)) return value === 'Inglês' ? 'Português' : 'Inglês';
  if (value === 'SIM') return 'NAO';
  if (value === 'NAO') return 'SIM';
  if (/^\d{4}$/.test(value)) return String(Number(value) - 1);
  // A carga horária vai só com dígitos (o check() da formação complementar).
  if (/CARGA-HORARIA/.test(attr)) return String((Number.parseInt(value, 10) || 0) + 1);
  // Data do XML (DDMMAAAA): outro dia do mesmo mês.
  if (/^\d{8}$/.test(value)) return `${value.startsWith('01') ? '02' : '01'}${value.slice(2)}`;
  return `${value} x`;
}

/** O editor com o conector que busca e lê cursos, e uma agência na cópia. */
const LIVE = {
  activityOrgans: true,
  agencies: [{ code: 'A0000000001', name: 'Agência' }],
  courses: true,
  organs: true,
  production: true,
  search: true,
};

/** A escolha na lista do Lattes, quando o editor oferece uma para o atributo; senão, false. */
function picked(el: XElement, attr: string, value: string, root: XElement): boolean {
  const parentOf = () => ancestorsOf(root, el).at(-1)?.name;
  switch (liveKind(el, attr, { ...LIVE, parentOf })) {
    case 'instituicao': {
      const course = courseAttrs(el);
      const hadCourse = (getAttr(el, course.code) ?? '') !== '';
      const ok = applyInstitution(
        el,
        { code: 'V0000000001', label: `${value} x`, name: `${value} x` },
        attr,
      );
      // A instituição nova limpa o curso, e o painel pede para escolher outro
      // pela lista (formacao-edit.ts); a pessoa faz as duas escolhas.
      if (ok && hadCourse && !getAttr(el, course.code)) {
        applyCourse(el, { label: `Curso x(00000000000P0)`, value: '0000000001' });
      }
      return ok;
    }
    case 'curso':
      return applyCourse(el, { label: `${value} x(00000000000P0)`, value: '0000000001' });
    case 'agencia':
      return applyAgency(el, { code: 'A0000000002', name: `${value} x` });
    case 'orgao':
      return applyOrgan(el, { code: '000000000002', kind: '0', name: `${value} x` });
    case 'unidade':
      return applyUnit(el, { code: '000000000003', kind: '0', name: `${value} x` });
    default:
      return false;
  }
}

/**
 * O coordenador do projeto troca de pessoa, nunca some nem dobra: o Lattes
 * exige um só. Marcar outro integrante desmarca o de antes, como a pessoa
 * faria com os dois botões; desmarcar o único não é uma troca possível.
 */
function swappedLead(work: XElement, member: XElement): boolean | undefined {
  if (member.name !== 'INTEGRANTES-DO-PROJETO') return undefined;
  if (getAttr(member, 'FLAG-RESPONSAVEL') === 'SIM') return false;
  const team = flatten(work).find(
    (e) => e.name === 'EQUIPE-DO-PROJETO' && e.children.includes(member),
  );
  for (const other of team?.children ?? []) {
    if (other.kind === 'element' && other !== member) setAttr(other, 'FLAG-RESPONSAVEL', 'NAO');
  }
  setAttr(member, 'FLAG-RESPONSAVEL', 'SIM');
  return true;
}

type Stats = Map<string, { no: number; ok: number; reasons: Map<string, number> }>;

/** Uma troca de teste: o campo (caminho e atributo), se virou envio e os motivos. */
interface Trial {
  attr: string;
  element: string;
  ok: boolean;
  path: string;
  reasons: string[];
}

/** O caminho de cada elemento, pelos nomes desde a raiz. */
const pathsOf = (root: XElement): Map<XElement, string> => {
  const out = new Map<XElement, string>();
  const walk = (e: XElement, prefix: string) => {
    const path = prefix ? `${prefix}/${e.name}` : e.name;
    out.set(e, path);
    for (const c of e.children) if (c.kind === 'element') walk(c, path);
  };
  walk(root, '');
  return out;
};

/** As trocas de um currículo, por elemento: quantas viram envio e por que as outras não. */
function cover(raw: string, trials: Trial[] = []): Stats {
  const base = parseXml(raw).root;
  const paths = pathsOf(base);
  const stats: Stats = new Map();
  flatten(base).forEach((el, index) => {
    const spec = lattesSchema.elements[el.name];
    if (!spec || (only && !only.includes(el.name))) return;
    for (const a of el.attrs) {
      // O que o editor não deixa digitar (códigos, números de sistema, o ID
      // Lattes do orientado, que o Lattes acha pelo nome): não é troca possível.
      if (/^SEQUENCIA|^CODIGO|^NRO-ID|ORDEM/.test(a.name) || isSystemAttr(el.name, a.name))
        continue;
      // Só para ler no editor: segue outro campo.
      if (followsCountry(el.name, a.name)) continue;
      /**
       * Planeja a troca do atributo para `value` (sem valor, a troca padrão).
       * Com `from`, o item parte desse valor em vez do que o exemplo tem.
       */
      const attempt = (value?: string, from?: string) => {
        const start = parseXml(raw).root;
        const work = parseXml(raw).root;
        const target = flatten(work)[index]!;
        if (from !== undefined) {
          setAttr(flatten(start)[index]!, a.name, from);
          setAttr(target, a.name, from);
        }
        const attr = target.attrs.find((x) => x.name === a.name)!;
        let choices: string[] | undefined;
        if (a.name === 'FLAG-RESPONSAVEL') {
          if (!swappedLead(work, target)) return undefined;
        } else if (value !== undefined || !picked(target, a.name, a.value, work)) {
          // A lista que o editor oferece no campo (a do schema, ou a do Lattes
          // nos campos tipados): a troca é outra opção dela, como a pessoa faria.
          // O tipo de um registro: só os do tipo de item (REGISTRY_KINDS).
          const kinds =
            a.name === 'TIPO-PATENTE'
              ? Object.entries(REGISTRY_KINDS).find(([k]) =>
                  paths.get(el)!.split('/').includes(k),
                )?.[1]
              : undefined;
          choices =
            kinds ??
            spec.attributes.find((x) => x.name === a.name)?.enum ??
            typedChoices(target, a.name)?.map((c) => c.value);
          attr.value = value ?? changed(a.name, a.value, choices);
          // O que o editor muda junto ao gravar (AttributeField chama o mesmo).
          applyLinkedAttrs(target, a.name, work);
        }
        const changes = diffDocuments(start, work);
        // O texto que o editor pede quando o valor novo o exige (o potencial de
        // inovação Sim): a pessoa o escreve ali.
        const extras = Object.fromEntries(
          changes.map((c) => [c.key, { f_txt_potencial: 'Texto de teste do potencial' }]),
        );
        const plan = planChanges(
          changes.map((change) => ({ change, itemTitle: '' })),
          work,
          { ...options, extras },
        );
        return { choices, ok: plan.ops.length > 0 && plan.unsupported.length === 0, plan };
      };
      let tried = attempt();
      if (!tried) continue;
      // Uma opção que o formulário não oferece (o Lattes não tem aquele
      // valor) não diz que o campo não vai: as outras opções da lista também
      // são tentadas, e o campo vai se uma delas vai.
      const valueMiss = (r: string) =>
        /^(Valor sem correspondência|Valor que o formulário|Tipo que o Lattes não tem|Tipo de participação que o Lattes não tem|Forma de participação que o Lattes não tem)/.test(
          r,
        );
      if (!tried.ok && tried.choices && tried.plan.unsupported.every((u) => valueMiss(u.reason))) {
        for (const other of tried.choices.filter((c) => c !== a.value)) {
          const next = attempt(other);
          if (next?.ok) {
            tried = next;
            break;
          }
        }
      }
      // O valor do exemplo pode ser um que o formulário não tem (WEB no meio
      // de divulgação): aí nenhuma troca a partir dele vai, mas o campo vai
      // num item que tenha um valor do formulário. Como os 138 valores fora
      // da lista do Lattes, o item parte de um valor que o formulário tem.
      // Um número que o exemplo traz como texto (a carga horária): parte de
      // um número.
      if (!tried.ok && /CARGA-HORARIA/.test(a.name)) {
        if (tried.plan.unsupported.every((u) => valueMiss(u.reason))) {
          const next = attempt('41', '40');
          if (next?.ok) tried = next;
        }
      }
      const choices = tried.choices ?? [];
      if (
        !tried.ok &&
        choices.length > 1 &&
        tried.plan.unsupported.every((u) => valueMiss(u.reason))
      ) {
        search: for (const from of choices.filter((c) => c !== a.value)) {
          for (const to of choices.filter((c) => c !== from)) {
            const next = attempt(to, from);
            if (next?.ok) {
              tried = next;
              break search;
            }
          }
        }
      }
      const { ok, plan } = tried;
      const s = stats.get(el.name) ?? { no: 0, ok: 0, reasons: new Map<string, number>() };
      trials.push({
        attr: a.name,
        element: el.name,
        ok,
        path: paths.get(el)!,
        reasons: plan.unsupported.map((u) => u.reason),
      });
      if (ok) s.ok++;
      else {
        s.no++;
        for (const u of plan.unsupported)
          s.reasons.set(u.reason, (s.reasons.get(u.reason) ?? 0) + 1);
      }
      stats.set(el.name, s);
    }
  });
  return stats;
}

/**
 * O tipo de item de um campo: o primeiro elemento do caminho que é um item
 * de lista no editor (o que vem logo abaixo de uma seção ou de um grupo).
 */
const itemOf = (key: string): string => {
  const parts = key.split(' @')[0]!.split('/');
  const groups =
    /^(CURRICULO-VITAE|DADOS-GERAIS|DADOS-COMPLEMENTARES|PRODUCAO-BIBLIOGRAFICA|PRODUCAO-TECNICA|OUTRA-PRODUCAO|PRODUCAO-ARTISTICA-CULTURAL|DEMAIS-TIPOS-DE-PRODUCAO-TECNICA|DEMAIS-TIPOS-DE-PRODUCAO-BIBLIOGRAFICA|ORIENTACOES-CONCLUIDAS|ORIENTACOES-EM-ANDAMENTO|PARTICIPACAO-EM-BANCA-TRABALHOS-CONCLUSAO|PARTICIPACAO-EM-BANCA-JULGADORA|PARTICIPACAO-EM-EVENTOS-CONGRESSOS|FORMACAO-ACADEMICA-TITULACAO|FORMACAO-COMPLEMENTAR|ATUACOES-PROFISSIONAIS|[A-Z-]+S-PUBLICADOS|[A-Z-]+-ACEITOS-PARA-PUBLICACAO|LIVROS-E-CAPITULOS|LIVROS-PUBLICADOS-OU-ORGANIZADOS|CAPITULOS-DE-LIVROS-PUBLICADOS|TRABALHOS-EM-EVENTOS|TEXTOS-EM-JORNAIS-OU-REVISTAS)$/;
  return parts.find((p) => !groups.test(p)) ?? parts.at(-1)!;
};

/** Os tipos de registro que cada tipo de item aceita (o formulário de cada um). */
const REGISTRY_KINDS: Record<string, string[]> = {
  'CULTIVAR-PROTEGIDA': ['CULTIVAR_PROTEGIDA_CTV'],
  'CULTIVAR-REGISTRADA': ['CULTIVAR_PROTEGIDA_CTV'],
  'DESENHO-INDUSTRIAL': ['DESENHO_INDUSTRIAL_DI'],
  MARCA: [
    'MARCA_REGISTRADA_DE_PRODUTO_MPD',
    'MARCA_REGISTRADA_DE_SERVICO_MSV',
    'MARCA_REGISTRADA_COLETIVA_MCL',
    'MARCA_REGISTRADA_DE_CERTIFICACAO_MCT',
  ],
  PATENTE: ['PRIVILEGIO_DE_INOVACAO_PI', 'MODELO_DE_UTILIDADE_MU'],
  SOFTWARE: ['PROGRAMA_DE_COMPUTADOR_PC'],
  'TOPOGRAFIA-DE-CIRCUITO-INTEGRADO': ['TOPOGRAFIA_DE_CIRCUITO_INTEGRADO_REGISTRADA_TCI'],
};

/** O motivo sem o que muda de item para item (o valor, o nome do campo). */
const reasonKind = (r: string) => r.replace(/:.*$/, '').trim();

/**
 * O synthetic_full tem valores inventados também nos campos de lista (a forma
 * de participação num evento, por exemplo), que nenhuma exportação traria; e
 * com o "antes" fora da lista, toda troca no item fica à mão. Aqui cada um
 * desses vira o valor que o Lattes deriva, ou a primeira opção da lista. Duas
 * passadas, porque uma lista pode depender de outra (o tipo segue a forma).
 * Só para o synthetic_full: um arquivo dado é medido como veio.
 */
function withListValues(raw: string): { rewritten: number; xml: string } {
  const doc = parseXml(raw);
  const was = new Map(flatten(doc.root).flatMap((el) => el.attrs.map((a) => [a, a.value])));
  // O tipo do registro, que o synthetic_full sorteia entre todos os do XSD: o
  // de cada tipo de item, como uma exportação traria.
  for (const item of flatten(doc.root)) {
    const kind = REGISTRY_KINDS[item.name];
    if (!kind) continue;
    for (const reg of flatten(item).filter((e) => e.name === 'REGISTRO-OU-PATENTE')) {
      setAttr(reg, 'TIPO-PATENTE', kind[0]!);
    }
  }
  for (let pass = 0; pass < 2; pass++) {
    for (const el of flatten(doc.root)) {
      for (const a of el.attrs) {
        // Um valor fora do enumerado do schema (FLAG-BOLSA="Valor de teste"),
        // que nenhuma exportação traria: a primeira opção dele.
        const choices = lattesSchema.elements[el.name]?.attributes.find(
          (x) => x.name === a.name,
        )?.enum;
        if (choices?.length && a.value && !choices.includes(a.value)) a.value = choices[0]!;
        // A nacionalidade do XML é B ou E (linked-attrs.ts).
        if (a.name === 'NACIONALIDADE' && !['B', 'E', ''].includes(a.value)) a.value = 'B';
        // FLAG-* sem enumerado guarda SIM ou NAO (field-kind.ts, isBooleanAttr).
        if (!choices && a.name.startsWith('FLAG-') && !['', 'SIM', 'NAO'].includes(a.value)) {
          a.value = 'NAO';
        }
        if (!outOfList(el, a.name)) continue;
        const value = derivedValue(el.name, a.name) ?? typedChoices(el, a.name)?.[0]?.value;
        if (value !== undefined) a.value = value;
      }
    }
  }
  const rewritten = [...was].filter(([a, v]) => a.value !== v).length;
  return { rewritten, xml: serializeXml(doc) };
}

const SYNTHETIC = 'fixtures/synthetic_full.xml';

/** O motivo do campo em que parte das trocas vai e o resto o Lattes não tem. */
const PARTIAL = 'Vai em parte: nas outras trocas o formulário do Lattes não tem o campo';

/** Os campos do editor, cada um uma vez: vai, o Lattes não tem, falta no conector. */
function fieldReport(file: string): void {
  const trials: Trial[] = [];
  const raw = readFileSync(file, 'latin1');
  const { rewritten, xml } = file === SYNTHETIC ? withListValues(raw) : { rewritten: 0, xml: raw };
  cover(xml, trials);
  const fields = new Map<string, Trial[]>();
  for (const t of trials) {
    const key = `${t.path} @${t.attr}`;
    fields.set(key, [...(fields.get(key) ?? []), t]);
  }
  type Kind = 'vai' | 'sem-campo' | 'falta';
  const kindOf = (ts: Trial[]): { kind: Kind; reason?: string } => {
    if (ts.every((t) => t.ok)) return { kind: 'vai' };
    // Por troca: uma que falhou sem motivo, ou com outro motivo, ou outra que
    // foi, tira o campo do "o Lattes não tem".
    const failed = ts.filter((t) => !t.ok);
    const absent = (t: Trial) => t.reasons.length > 0 && t.reasons.every(fieldAbsent);
    if (failed.length === ts.length && failed.every(absent)) return { kind: 'sem-campo' };
    const reasons = failed.flatMap((t) => t.reasons);
    const own = reasons.find((r) => !fieldAbsent(r));
    if (own) return { kind: 'falta', reason: own };
    // Toda troca que falhou tem motivo e é de campo ausente: as outras foram.
    return { kind: 'falta', reason: failed.every(absent) ? PARTIAL : 'sem motivo' };
  };
  const sections = new Map<string, Record<Kind, number>>();
  const missing = new Map<string, { els: Set<string>; n: number }>();
  const byItem = new Map<string, number>();
  const count = { falta: 0, 'sem-campo': 0, vai: 0 };
  for (const [key, ts] of fields) {
    const { kind, reason } = kindOf(ts);
    count[kind]++;
    // A seção e, dentro de dados gerais e complementares, a parte (formação,
    // atuação, orientações…), que é como o editor as mostra.
    const parts = key.split(' @')[0]!.split('/');
    const section =
      parts.length < 2
        ? 'CURRICULO-VITAE'
        : /^DADOS-(GERAIS|COMPLEMENTARES)$/.test(parts[1]!) && parts[2]
          ? `${parts[1]} › ${parts[2]}`
          : parts[1]!;
    const row = sections.get(section) ?? { falta: 0, 'sem-campo': 0, vai: 0 };
    row[kind]++;
    sections.set(section, row);
    if (kind === 'falta') {
      const item = itemOf(key);
      byItem.set(item, (byItem.get(item) ?? 0) + 1);
    }
    if (reason) {
      const r = reasonKind(reason);
      const m = missing.get(r) ?? { els: new Set<string>(), n: 0 };
      m.els.add(ts[0]!.element);
      m.n++;
      missing.set(r, m);
    }
  }
  const dump = args.find((a) => a.startsWith('--lista='))?.slice(8);
  if (dump) {
    for (const [key, ts] of fields) {
      const { kind, reason } = kindOf(ts);
      if (
        kind === 'falta' &&
        (itemOf(key) === dump || (dump.startsWith('motivo:') && reason?.startsWith(dump.slice(7))))
      )
        console.log(`${key}\t${reason}`);
    }
    return;
  }
  const editable = count.vai + count.falta;
  const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)}%` : '-');
  if (!summaryOnly) {
    console.log('Por seção (campos): vão / faltam no conector / o Lattes não tem');
    for (const [name, r] of [...sections.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      console.log(
        `  ${name.padEnd(56)} ${String(r.vai).padStart(4)} / ${String(r.falta).padStart(4)} / ${String(r['sem-campo']).padStart(4)}   ${pct(r.vai, r.vai + r.falta)}`,
      );
    }
    console.log('\nO que falta no conector, por tipo de item (campos):');
    for (const [item, n] of [...byItem.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${String(n).padStart(4)}  ${item}`);
    }
    console.log('\nO que falta no conector, por motivo (campos e tipos de item):');
    const rows = [...missing.entries()].map(([r, m]) => ({ ...m, r }));
    for (const { els, n, r } of rows.sort((a, b) => b.n - a.n)) {
      const list = [...els].slice(0, 4).join(', ');
      console.log(`  ${String(n).padStart(4)}  ${r}  (${list}${els.size > 4 ? ', …' : ''})`);
    }
  }
  console.log(
    `\n${count.vai} de ${editable} campos que o Lattes aceita vão pelo conector (${pct(count.vai, editable)}). ` +
      `Outros ${count['sem-campo']} o formulário do Lattes não tem e ficam só para ler. ` +
      `${fields.size} campos no total.${
        rewritten > 0
          ? ` No exemplo, ${rewritten} valores fora da lista do Lattes viraram o da lista antes da medição.`
          : ''
      }`,
  );
}

if (byCv) cvReport();
else fieldReport(named ?? SYNTHETIC);

/** A contagem antiga, por troca de atributo em cada currículo. */
function cvReport(): void {
  const totals: string[] = [];
  for (const file of files) {
    const stats = cover(readFileSync(file, 'latin1'));
    let total = 0;
    let sent = 0;
    if (!summaryOnly && files.length > 1) console.log(`\n== ${file}`);
    for (const [name, s] of [...stats.entries()].sort((a, b) => b[1].no - a[1].no)) {
      total += s.ok + s.no;
      sent += s.ok;
      if (summaryOnly) continue;
      const reasons = [...s.reasons.entries()].map(([r, n]) => `\n    ${n}× ${r}`).join('');
      console.log(`${s.no ? '✗' : '✓'} ${name}  enviáveis ${s.ok}, à mão ${s.no}${reasons}`);
    }
    totals.push(`${file}: ${sent} de ${total} trocas de atributo viram envio.`);
  }
  console.log(`\n${totals.join('\n')}`);
}
