// O relatório do censo em Markdown (docs/lattes-formularios/relatorio.md),
// gerado por scripts/censo-relatorio.ts. Tudo pt-BR; só nomes de campo,
// atributo e procedimento, nenhum valor do currículo.

import type { AttributeRow, Coverage, Disagreement, Group } from './report.ts';
import type { CensusTarget } from './targets.ts';

const GROUPS: [Group, string][] = [
  ['opcoes', 'com opções'],
  ['texto', 'texto livre'],
  ['oculto', 'oculto'],
  ['fora', 'fora do formulário'],
  ['sem-captura', 'sem captura'],
];

const LOCATE: Record<CensusTarget['locate']['kind'], string> = {
  fixed: 'endereço conhecido',
  list: 'link da lista',
  menu: 'link do menu',
  unknown: 'endereço desconhecido',
};

function counts(rows: AttributeRow[]): Record<Group, number> {
  const out = { fora: 0, oculto: 0, opcoes: 0, 'sem-captura': 0, texto: 0 } as Record<
    Group,
    number
  >;
  for (const r of rows) out[r.group]++;
  return out;
}

const cell = (text: string) => text.replace(/\|/g, '\\|');

function summaryTable(rows: AttributeRow[]): string[] {
  const c = counts(rows);
  const uniq = new Map<string, Group>();
  const rank = (g: Group) => GROUPS.findIndex(([k]) => k === g);
  for (const r of rows) {
    const key = `${r.element}@${r.attribute}`;
    const prev = uniq.get(key);
    if (!prev || rank(r.group) < rank(prev)) uniq.set(key, r.group);
  }
  const u = counts([...uniq.values()].map((group) => ({ group }) as AttributeRow));
  return [
    '| Grupo | Atributo por formulário | Atributo distinto |',
    '| ----- | ----------------------: | ----------------: |',
    ...GROUPS.map(([g, label]) => `| ${label} | ${c[g]} | ${u[g]} |`),
    `| total | ${rows.length} | ${uniq.size} |`,
  ];
}

function targetTable(targets: CensusTarget[], cov: Coverage, rows: AttributeRow[]): string[] {
  const lines = [
    '| Formulário | Como abre | Endereço | Elementos | Captura | Opções | Texto | Oculto | Fora |',
    '| ---------- | --------- | -------- | --------- | ------- | -----: | ----: | -----: | ---: |',
  ];
  for (const t of targets) {
    const cap = cov.captured.get(t.id);
    const c = counts(rows.filter((r) => r.target === t.id));
    const capture = cap ? cap.at.slice(0, 10) : 'falta';
    const nums = cap ? [c.opcoes, c.texto, c.oculto, c.fora] : ['', '', '', ''];
    lines.push(
      `| ${cell(`${t.label} (\`${t.id}\`)`)} | ${LOCATE[t.locate.kind]} | ${t.provenance} | ${t.elementsProvenance} | ${capture} | ${nums.join(' | ')} |`,
    );
  }
  return lines;
}

function detail(t: CensusTarget, rows: AttributeRow[]): string[] {
  const mine = rows.filter((r) => r.target === t.id);
  const lines = [`<details><summary>${t.label} (${t.id})</summary>`, ''];
  for (const [g, label] of GROUPS) {
    const list = mine.filter((r) => r.group === g);
    if (!list.length) continue;
    lines.push(`**${label}**`, '');
    for (const r of list) {
      const via = r.field ? ` ← \`${r.field}\` (${r.link})` : '';
      lines.push(`- \`${r.element}@${r.attribute}\`${via}`);
    }
    lines.push('');
  }
  lines.push('</details>', '');
  return lines;
}

function disagreementLines(list: Disagreement[], accepted: Set<string>): string[] {
  if (!list.length) return ['Nenhuma.', ''];
  return [
    ...list.map((d) => `- ${d.detail}${accepted.has(d.key) ? ' (aceita em pendencias.json)' : ''}`),
    '',
  ];
}

export function renderReport(
  targets: CensusTarget[],
  cov: Coverage,
  accepted: readonly string[] = [],
): string {
  const captured = targets.filter((t) => cov.captured.has(t.id));
  const missing = targets.filter((t) => !cov.captured.has(t.id));
  const out = [
    '# Censo dos formulários do Lattes: cobertura',
    '',
    'Gerado por `pnpm censo:relatorio` a partir das capturas em `docs/lattes-formularios/`',
    'e de `src/schema/lattes.json`. Não editar à mão. Como capturar e o que cada',
    'grupo quer dizer está no `README.md` desta pasta.',
    '',
    `Formulários no censo: ${targets.length}, com captura: ${captured.length}, sem captura: ${missing.length}.`,
    '',
    '## Atributos por grupo',
    '',
    ...summaryTable(cov.rows),
    '',
    '## Formulários',
    '',
    '"Endereço" diz se o caminho do formulário foi visto no Lattes; "Elementos", se a',
    'ligação do formulário com os elementos do XML foi conferida.',
    '',
    ...targetTable(targets, cov, cov.rows),
    '',
    '## Divergências entre o Lattes capturado e o editor',
    '',
    ...disagreementLines(cov.disagreements, new Set(accepted)),
    '## Lacunas',
    '',
    `Formulários sem captura: ${missing.map((t) => `\`${t.id}\``).join(', ') || 'nenhum'}.`,
    '',
    `Elementos do schema que nenhum formulário do censo cobre: ${cov.uncovered.map((e) => `\`${e}\``).join(', ') || 'nenhum'}.`,
    '',
  ];
  if (captured.length) {
    out.push('## Atributos de cada formulário capturado', '');
    for (const t of captured) out.push(...detail(t, cov.rows));
  }
  return `${out.join('\n').trimEnd()}\n`;
}
