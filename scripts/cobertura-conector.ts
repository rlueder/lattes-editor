// Quanto do editor o conector consegue enviar ao Lattes. Para cada atributo
// de cada elemento de um currículo, troca o valor numa cópia, planeja o envio
// com todas as funções do conector ligadas e anota o que vira operação e o
// que fica à mão, com o motivo. Uso:
//
//   node scripts/cobertura-conector.ts [--resumo]
//   node scripts/cobertura-conector.ts --por-curriculo [arquivo.xml] [--so=ELEMENTO,...]
//
// O padrão conta campos: cada campo do editor (o caminho do elemento no XML e
// o atributo) uma vez só, de fixtures/synthetic_full.xml, que tem todos os
// elementos do schema. Um campo vai pelo conector quando toda troca nele
// vira envio; senão, ou o formulário do Lattes não tem onde gravá-lo (fica só
// para ler no editor, pelo mesmo fieldAbsent que o editor usa) ou falta no
// conector. --resumo mostra só os totais.
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
  applyAgency,
  applyCourse,
  applyInstitution,
  applyOrgan,
  applyUnit,
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
  return `${value} x`;
}

/** O editor com o conector que busca e lê cursos, e uma agência na cópia. */
const LIVE = {
  agencies: [{ code: 'A0000000001', name: 'Agência' }],
  courses: true,
  organs: true,
  production: true,
  search: true,
};

/** A escolha na lista do Lattes, quando o editor oferece uma para o atributo; senão, false. */
function picked(el: XElement, attr: string, value: string): boolean {
  switch (liveKind(el, attr, LIVE)) {
    case 'instituicao':
      return applyInstitution(
        el,
        { code: 'V0000000001', label: `${value} x`, name: `${value} x` },
        attr,
      );
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
      const work = parseXml(raw).root;
      const target = flatten(work)[index]!;
      const attr = target.attrs.find((x) => x.name === a.name)!;
      if (a.name === 'FLAG-RESPONSAVEL') {
        if (!swappedLead(work, target)) continue;
      } else if (!picked(target, a.name, a.value)) {
        // A lista que o editor oferece no campo (a do schema, ou a do Lattes
        // nos campos tipados): a troca é outra opção dela, como a pessoa faria.
        const choices =
          spec.attributes.find((x) => x.name === a.name)?.enum ??
          typedChoices(target, a.name)?.map((c) => c.value);
        attr.value = changed(a.name, a.value, choices);
        // O que o editor muda junto ao gravar (AttributeField chama o mesmo).
        applyLinkedAttrs(target, a.name);
      }
      const changes = diffDocuments(base, work);
      const plan = planChanges(
        changes.map((change) => ({ change, itemTitle: '' })),
        work,
        options,
      );
      const s = stats.get(el.name) ?? { no: 0, ok: 0, reasons: new Map<string, number>() };
      const ok = plan.ops.length > 0 && plan.unsupported.length === 0;
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

/** O motivo sem o que muda de item para item (o valor, o nome do campo). */
const reasonKind = (r: string) => r.replace(/:.*$/, '').trim();

/**
 * O synthetic_full tem valores inventados também nos campos de lista (a forma
 * de participação num evento, por exemplo), que nenhuma exportação traria; e
 * com o "antes" fora da lista, toda troca no item fica à mão. Aqui cada um
 * desses vira o valor que o Lattes deriva, ou a primeira opção da lista. Duas
 * passadas, porque uma lista pode depender de outra (o tipo segue a forma).
 */
function withListValues(raw: string): string {
  const doc = parseXml(raw);
  for (let pass = 0; pass < 2; pass++) {
    for (const el of flatten(doc.root)) {
      for (const a of el.attrs) {
        if (!outOfList(el, a.name)) continue;
        const value = derivedValue(el.name, a.name) ?? typedChoices(el, a.name)?.[0]?.value;
        if (value !== undefined) a.value = value;
      }
    }
  }
  return serializeXml(doc);
}

/** Os campos do editor, cada um uma vez: vai, o Lattes não tem, falta no conector. */
function fieldReport(): void {
  const trials: Trial[] = [];
  cover(withListValues(readFileSync('fixtures/synthetic_full.xml', 'latin1')), trials);
  const fields = new Map<string, Trial[]>();
  for (const t of trials) {
    const key = `${t.path} @${t.attr}`;
    fields.set(key, [...(fields.get(key) ?? []), t]);
  }
  type Kind = 'vai' | 'sem-campo' | 'falta';
  const kindOf = (ts: Trial[]): { kind: Kind; reason?: string } => {
    if (ts.every((t) => t.ok)) return { kind: 'vai' };
    const reasons = ts.flatMap((t) => t.reasons);
    if (reasons.length > 0 && reasons.every(fieldAbsent)) return { kind: 'sem-campo' };
    return { kind: 'falta', reason: reasons.find((r) => !fieldAbsent(r)) ?? 'sem motivo' };
  };
  const sections = new Map<string, Record<Kind, number>>();
  const missing = new Map<string, Set<string>>();
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
    if (reason) {
      const r = reasonKind(reason);
      missing.set(r, (missing.get(r) ?? new Set()).add(ts[0]!.element));
    }
  }
  const editable = count.vai + count.falta;
  const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)}%` : '-');
  if (!summaryOnly) {
    console.log('Por seção (campos): vão / faltam no conector / o Lattes não tem');
    for (const [name, r] of [...sections.entries()].sort()) {
      console.log(
        `  ${name.padEnd(56)} ${String(r.vai).padStart(4)} / ${String(r.falta).padStart(4)} / ${String(r['sem-campo']).padStart(4)}   ${pct(r.vai, r.vai + r.falta)}`,
      );
    }
    console.log('\nO que falta no conector, por motivo (campos e tipos de item):');
    const rows = [...missing.entries()].map(([r, els]) => ({
      els,
      n: [...fields.values()].filter((ts) => {
        const k = kindOf(ts);
        return k.reason && reasonKind(k.reason) === r;
      }).length,
      r,
    }));
    for (const { els, n, r } of rows.sort((a, b) => b.n - a.n)) {
      const list = [...els].slice(0, 4).join(', ');
      console.log(`  ${String(n).padStart(4)}  ${r}  (${list}${els.size > 4 ? ', …' : ''})`);
    }
  }
  console.log(
    `\n${count.vai} de ${editable} campos que o Lattes aceita vão pelo conector (${pct(count.vai, editable)}). ` +
      `Outros ${count['sem-campo']} o formulário do Lattes não tem e ficam só para ler. ` +
      `${fields.size} campos no total.`,
  );
}

if (!byCv) {
  fieldReport();
  process.exit(0);
}

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
