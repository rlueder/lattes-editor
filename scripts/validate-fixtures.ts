// Valida todo XML de fixtures/ (e os caminhos passados na linha de comando)
// contra o XSD com patch, usando xmllint. Roda na CI.
//
// Uso: pnpm validate:fixtures [arquivo.xml ...]

import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const XSD = join(ROOT, 'schema/CurriculoLattes_2022_patched.xsd');

const extra = process.argv.slice(2);
const files = [
  ...readdirSync(join(ROOT, 'fixtures'))
    .filter((f) => f.endsWith('.xml'))
    .map((f) => join(ROOT, 'fixtures', f)),
  ...extra,
];

let failed = 0;
for (const file of files) {
  try {
    execFileSync('xmllint', ['--noout', '--schema', XSD, file], { stdio: 'pipe' });
    console.log(`ok    ${file}`);
  } catch (err) {
    failed++;
    const stderr = (err as { stderr?: Buffer }).stderr?.toString() ?? String(err);
    console.error(`FALHA ${file}\n${stderr}`);
  }
}
if (failed > 0) process.exit(1);
