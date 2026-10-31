// Compara dois pacotes da loja (lattes-editor-extensao-loja.zip) e diz se a
// extensão mudou. Só version e version_name do manifest não contam; qualquer
// outro byte, arquivo novo ou arquivo removido conta.
//
//   node scripts/extensao-mudou.ts antigo.zip novo.zip
//
// Escreve mudou=true|false no $GITHUB_OUTPUT, quando existe.
import { appendFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { readZip } from '../src/import-export/zip.ts';

const LIMITS = {
  maxEntries: 1024,
  maxInputBytes: 32 * 1024 * 1024,
  maxOutputBytes: 128 * 1024 * 1024,
};

async function contents(zip: Uint8Array): Promise<Map<string, Uint8Array>> {
  const files = new Map<string, Uint8Array>();
  for (const entry of await readZip(zip, LIMITS)) {
    if (files.has(entry.name)) throw new Error(`Entrada repetida no ZIP: ${entry.name}`);
    files.set(entry.name, entry.data);
  }
  if (!files.has('manifest.json')) throw new Error('O ZIP não tem manifest.json na raiz.');
  return files;
}

/** O manifest sem version e version_name, na ordem original das chaves. */
function manifestWithoutVersion(data: Uint8Array): string {
  const manifest: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(data));
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    throw new Error('O manifest.json não é um objeto.');
  }
  const { version: _version, version_name: _name, ...rest } = manifest as Record<string, unknown>;
  return JSON.stringify(rest);
}

function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  return a.length === b.length && a.every((byte, i) => byte === b[i]);
}

/** Os arquivos que diferem entre os dois pacotes, em ordem alfabética; vazio se a extensão é a mesma. */
export async function extensionChanges(before: Uint8Array, after: Uint8Array): Promise<string[]> {
  const old = await contents(before);
  const now = await contents(after);
  const names = [...new Set([...old.keys(), ...now.keys()])].sort();
  return names.filter((name) => {
    const a = old.get(name);
    const b = now.get(name);
    if (!a || !b) return true;
    if (name === 'manifest.json') return manifestWithoutVersion(a) !== manifestWithoutVersion(b);
    return !sameBytes(a, b);
  });
}

async function main(): Promise<void> {
  const [before, after] = process.argv.slice(2);
  if (!before || !after) throw new Error('Uso: node scripts/extensao-mudou.ts antigo.zip novo.zip');
  const changes = await extensionChanges(readFileSync(before), readFileSync(after));
  const changed = changes.length > 0;
  console.log(
    changed ? `A extensão mudou: ${changes.join(', ')}` : 'A extensão não mudou, só a versão.',
  );
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `mudou=${changed}\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : 'Falha ao comparar os pacotes.');
    process.exitCode = 1;
  });
}
