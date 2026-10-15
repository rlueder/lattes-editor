// Gera docs/lattes-formularios/relatorio.md a partir das capturas do censo
// (docs/lattes-formularios/censo-*.json) e de src/schema/lattes.json (LAT-55).
// Com --aceitar, grava em pendencias.json as divergências de agora (com o
// motivo de cada uma, que se escreve à mão), para o
// teste (tests/census-coverage.test.ts) só reprovar as que aparecerem depois.
//
//   pnpm censo:relatorio
//   pnpm censo:relatorio --aceitar

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { format, resolveConfig } from 'prettier';

import {
  type AcceptedGap,
  compareWithAccepted,
  coverage,
  type FormSlot,
} from '../src/census/report.ts';
import { renderReport } from '../src/census/report-render.ts';
import type { CensusFile } from '../src/census/run.ts';
import { CENSUS_TARGETS } from '../src/census/targets-production.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
export const CENSUS_DIR = `${root}docs/lattes-formularios/`;
export const REPORT_PATH = `${CENSUS_DIR}relatorio.md`;
export const ACCEPTED_PATH = `${CENSUS_DIR}pendencias.json`;

/** As capturas versionadas, da mais antiga para a mais nova. */
export function loadCensusFiles(dir = CENSUS_DIR): CensusFile[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => /^censo-.*\.json$/.test(f))
    .sort()
    .map((f) => JSON.parse(readFileSync(`${dir}${f}`, 'utf8')) as CensusFile);
}

/** As divergências aceitas, cada uma com o motivo. */
export function loadAccepted(path = ACCEPTED_PATH): AcceptedGap[] {
  if (!existsSync(path)) return [];
  return (JSON.parse(readFileSync(path, 'utf8')) as { pendencias: AcceptedGap[] }).pendencias;
}

/**
 * A ordem dos campos do editor (src/ui/form-order.ts), se o arquivo existe
 * nesta versão. Sem ele, a comparação de ordem fica de fora.
 */
export async function loadFormSlot(): Promise<FormSlot | undefined> {
  const path = `${root}src/ui/form-order.ts`;
  if (!existsSync(path)) return undefined;
  const mod = (await import(/* @vite-ignore */ pathToFileURL(path).href)) as {
    formSlot?: FormSlot;
  };
  return mod.formSlot;
}

export async function buildReport(): Promise<{ accepted: AcceptedGap[]; text: string }> {
  const files = loadCensusFiles();
  const accepted = loadAccepted();
  const cov = coverage({ files, formSlot: await loadFormSlot(), targets: CENSUS_TARGETS });
  const raw = renderReport(CENSUS_TARGETS, cov, accepted);
  const text = await format(raw, { ...(await resolveConfig(REPORT_PATH)), filepath: REPORT_PATH });
  return { accepted, text };
}

async function main(): Promise<void> {
  const files = loadCensusFiles();
  const cov = coverage({ files, formSlot: await loadFormSlot(), targets: CENSUS_TARGETS });
  if (process.argv.includes('--aceitar')) {
    // Mantém o motivo das que já estavam; as novas entram para alguém escrever o porquê.
    const before = new Map(loadAccepted().map((a) => [a.key, a.reason]));
    const body = {
      pendencias: cov.disagreements.map((d) => ({
        key: d.key,
        reason: before.get(d.key) ?? 'a escrever',
      })),
    };
    const text = await format(JSON.stringify(body), {
      ...(await resolveConfig(ACCEPTED_PATH)),
      filepath: ACCEPTED_PATH,
    });
    writeFileSync(ACCEPTED_PATH, text);
    console.log(`pendencias.json: ${body.pendencias.length} divergências aceitas`);
  }
  const { accepted, text } = await buildReport();
  writeFileSync(REPORT_PATH, text);
  const { fresh, resolved } = compareWithAccepted(
    cov.disagreements,
    accepted.map((a) => a.key),
  );
  console.log(
    `relatorio.md: ${files.length} capturas, ${cov.captured.size} de ${CENSUS_TARGETS.length} formulários com captura, ${cov.disagreements.length} divergências`,
  );
  for (const d of fresh) console.log(`  nova: ${d.detail}`);
  for (const k of resolved) console.log(`  resolvida (tirar de pendencias.json): ${k}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) await main();
