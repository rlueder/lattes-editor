// Quanto do currículo o conector consegue enviar ao Lattes. Para cada
// atributo de cada elemento de um currículo, troca o valor numa cópia, planeja
// o envio com todas as funções do conector ligadas e conta o que vira operação
// e o que fica à mão, com o motivo. Uso:
//
//   node scripts/cobertura-conector.ts [arquivo.xml] [--so=ELEMENTO,...]
//
// Sem arquivo, lê fixtures/demo.xml. A troca é sintética (outro valor do
// enumerado, o ano anterior, o texto com " x"), e por isso um motivo do tipo
// "valor sem correspondência" pode ser da troca e não do conector.

import { readFileSync } from 'node:fs';

import { BRIDGE_FEATURES } from '../src/bridge/compat.ts';
import { planChanges, planOptionsFor } from '../src/bridge/plan.ts';
import { diffDocuments } from '../src/model/changes.ts';
import { parseXml, type XElement } from '../src/model/xml.ts';
import { lattesSchema } from '../src/schema/lattes.ts';

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

const base = parseXml(raw).root;
const stats = new Map<string, { no: number; ok: number; reasons: Map<string, number> }>();
flatten(base).forEach((el, index) => {
  const spec = lattesSchema.elements[el.name];
  if (!spec || (only && !only.includes(el.name))) return;
  for (const a of el.attrs) {
    if (/^SEQUENCIA|^CODIGO|^NRO-ID|ORDEM/.test(a.name)) continue;
    const work = parseXml(raw).root;
    const target = flatten(work)[index]!;
    const attr = target.attrs.find((x) => x.name === a.name)!;
    attr.value = changed(a.name, a.value, spec.attributes.find((x) => x.name === a.name)?.enum);
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
