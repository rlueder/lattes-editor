import { describe, expect, it } from 'vitest';

import { extensionChanges } from '../scripts/extensao-mudou.ts';
import { buildZip } from './helpers/zip.ts';

const text = (value: string) => new TextEncoder().encode(value);

function manifest(fields: Record<string, unknown> = {}): Uint8Array {
  return text(
    `${JSON.stringify({ manifest_version: 3, name: 'LattesEditor: Conector', version: '1.0.0', ...fields }, null, 2)}\n`,
  );
}

function pack(files: Record<string, Uint8Array>): Promise<Uint8Array> {
  return buildZip(Object.entries(files).map(([name, data]) => ({ data, name })));
}

const base = {
  'background.js': text('console.log(1);\n'),
  'icons/': new Uint8Array(),
  'icons/icon-16.png': new Uint8Array([137, 80, 78, 71]),
  'manifest.json': manifest(),
};

describe('comparação dos pacotes da loja', () => {
  it('não vê mudança quando só version e version_name mudam', async () => {
    const before = await pack(base);
    const after = await pack({
      ...base,
      'manifest.json': manifest({ version: '1.1.0', version_name: '1.1.0' }),
    });
    await expect(extensionChanges(before, after)).resolves.toEqual([]);
  });

  it('não depende da compressão de cada entrada', async () => {
    const before = await pack(base);
    const after = await buildZip(
      Object.entries(base).map(([name, data]) => ({ data, method: 0 as const, name })),
    );
    await expect(extensionChanges(before, after)).resolves.toEqual([]);
  });

  it('vê qualquer outra mudança no manifest', async () => {
    const before = await pack(base);
    const after = await pack({ ...base, 'manifest.json': manifest({ permissions: ['storage'] }) });
    await expect(extensionChanges(before, after)).resolves.toEqual(['manifest.json']);
  });

  it('vê um byte diferente num arquivo', async () => {
    const before = await pack(base);
    const after = await pack({ ...base, 'background.js': text('console.log(2);\n') });
    await expect(extensionChanges(before, after)).resolves.toEqual(['background.js']);
  });

  it('vê arquivo novo e arquivo removido', async () => {
    const { 'background.js': _removed, ...rest } = base;
    const before = await pack(base);
    const after = await pack({ ...rest, 'panel.js': text('') });
    await expect(extensionChanges(before, after)).resolves.toEqual(['background.js', 'panel.js']);
  });

  it('recusa pacote sem manifest, com manifest inválido ou entrada repetida', async () => {
    const ok = await pack(base);
    const { 'manifest.json': _manifest, ...semManifest } = base;
    await expect(extensionChanges(await pack(semManifest), ok)).rejects.toThrow('manifest.json');
    await expect(
      extensionChanges(await pack({ ...base, 'manifest.json': text('[]') }), ok),
    ).rejects.toThrow('não é um objeto');
    await expect(
      extensionChanges(await pack({ ...base, 'manifest.json': text('{') }), ok),
    ).rejects.toThrow();
    const repeated = await buildZip([
      { data: manifest(), name: 'manifest.json' },
      { data: manifest(), name: 'manifest.json' },
    ]);
    await expect(extensionChanges(ok, repeated)).rejects.toThrow('repetida');
  });
});
