// Quanto do currículo o conector consegue enviar ao Lattes. Para cada
// atributo de cada elemento de um currículo, troca o valor numa cópia, planeja
// o envio com todas as funções do conector ligadas e conta o que vira operação
// e o que fica à mão, com o motivo. Uso:
//
//   node scripts/cobertura-conector.ts [arquivo.xml] [--so=ELEMENTO,...]
//
// Sem arquivo, lê fixtures/demo.xml. A troca é sintética (outro valor do
// enumerado, o ano anterior, o texto com " x"), e por isso um motivo do tipo
// "valor sem correspondência" pode ser da troca e não do conector. Onde o
// editor oferece a lista do Lattes (instituição, curso, agência), a troca é a
// escolha nela, com código e nome juntos, como a pessoa faria: trocar só o
// nome é o caso que o planejador recusa de propósito.

import { readFileSync } from 'node:fs';

import { BRIDGE_FEATURES } from '../src/bridge/compat.ts';
import { planChanges, planOptionsFor } from '../src/bridge/plan.ts';
import { diffDocuments } from '../src/model/changes.ts';
import { applyLinkedAttrs, followsCountry } from '../src/model/linked-attrs.ts';
import { getAttr, parseXml, setAttr, type XElement } from '../src/model/xml.ts';
import { lattesSchema } from '../src/schema/lattes.ts';
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
const file = args.find((a) => !a.startsWith('--')) ?? 'fixtures/demo.xml';
const only = args
  .find((a) => a.startsWith('--so='))
  ?.slice(5)
  .split(',');
const raw = readFileSync(file, 'latin1');
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

const base = parseXml(raw).root;
const stats = new Map<string, { no: number; ok: number; reasons: Map<string, number> }>();
flatten(base).forEach((el, index) => {
  const spec = lattesSchema.elements[el.name];
  if (!spec || (only && !only.includes(el.name))) return;
  for (const a of el.attrs) {
    // O que o editor não deixa digitar (códigos, números de sistema, o ID
    // Lattes do orientado, que o Lattes acha pelo nome): não é troca possível.
    if (/^SEQUENCIA|^CODIGO|^NRO-ID|ORDEM/.test(a.name) || isSystemAttr(el.name, a.name)) continue;
    // Só para ler no editor: segue outro campo.
    if (followsCountry(el.name, a.name)) continue;
    const work = parseXml(raw).root;
    const target = flatten(work)[index]!;
    const attr = target.attrs.find((x) => x.name === a.name)!;
    if (a.name === 'FLAG-RESPONSAVEL') {
      if (!swappedLead(work, target)) continue;
    } else if (!picked(target, a.name, a.value)) {
      attr.value = changed(a.name, a.value, spec.attributes.find((x) => x.name === a.name)?.enum);
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
    if (plan.ops.length > 0 && plan.unsupported.length === 0) s.ok++;
    else {
      s.no++;
      for (const u of plan.unsupported) s.reasons.set(u.reason, (s.reasons.get(u.reason) ?? 0) + 1);
    }
    stats.set(el.name, s);
  }
});

let total = 0;
let sent = 0;
for (const [name, s] of [...stats.entries()].sort((a, b) => b[1].no - a[1].no)) {
  total += s.ok + s.no;
  sent += s.ok;
  const reasons = [...s.reasons.entries()].map(([r, n]) => `\n    ${n}× ${r}`).join('');
  console.log(`${s.no ? '✗' : '✓'} ${name}  enviáveis ${s.ok}, à mão ${s.no}${reasons}`);
}
console.log(`\n${sent} de ${total} trocas de atributo viram envio.`);
