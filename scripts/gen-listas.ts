// Gera src/schema/listas-lattes.json, as listas que o editor oferece nos campos
// tipados (LAT-48), a partir da captura dos formulários do próprio Lattes em
// docs/lattes-listas/. Só entram listas cujo formato no XML foi conferido numa
// exportação real (ver docs/campos_tipados.md, "Achados").
//
//   node scripts/gen-listas.ts

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { format, resolveConfig } from 'prettier';

const root = fileURLToPath(new URL('../', import.meta.url));
const CAPTURE = 'docs/lattes-listas/captura-2026-10-13.json';

interface Capture {
  capturedAt: string;
  forms: { selects: { list: string; name: string }[] }[];
  lists: Record<string, string[]>;
}

const capture = JSON.parse(readFileSync(root + CAPTURE, 'utf8')) as Capture;

/** A lista de um controle (pelo nome no formulário), a mais longa entre os formulários. */
function listOf(control: string): string[] {
  const ids = capture.forms.flatMap((f) =>
    f.selects.filter((s) => s.name === control).map((s) => s.list),
  );
  const lists = ids.map((id) => capture.lists[id] ?? []);
  return lists.sort((a, b) => b.length - a.length)[0] ?? [];
}

/** Nomes na ordem do Lattes (os mais usados primeiro), sem vazios nem repetidos. */
function names(control: string): string[] {
  const seen = new Set<string>();
  return listOf(control)
    .map((o) => o.split('|').slice(1).join('|').trim())
    .filter((n) => n && !seen.has(n) && seen.add(n));
}

const out = {
  capturedAt: capture.capturedAt,
  /** F_IDIOMA: nas produções, o XML guarda o nome (Português na exportação real). */
  idiomas: names('F_IDIOMA'),
  /** f_pais: o XML guarda o nome (Brasil, Argentina, Portugal na exportação real). */
  paises: names('f_pais'),
  source: CAPTURE,
};
// Formatado pelo Prettier, senão o format:check e o gerador se reprovam.
const path = `${root}src/schema/listas-lattes.json`;
writeFileSync(
  path,
  await format(JSON.stringify(out), { ...(await resolveConfig(path)), filepath: path }),
);
console.log(
  `src/schema/listas-lattes.json: ${out.paises.length} países, ${out.idiomas.length} idiomas`,
);
