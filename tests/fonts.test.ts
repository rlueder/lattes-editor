import { readdirSync, readFileSync } from 'node:fs';

import { expect, it } from 'vitest';

// A página do projeto (site/) é estática e leva a própria cópia da IBM Plex.
// A cópia não pode divergir da do editor (src/ui/fonts).
it('site/fonts é cópia exata de src/ui/fonts', () => {
  const root = new URL('../', import.meta.url).pathname;
  const files = readdirSync(`${root}src/ui/fonts`).sort();
  expect(readdirSync(`${root}site/fonts`).sort()).toEqual(files);
  for (const f of files) {
    expect(
      readFileSync(`${root}site/fonts/${f}`).equals(readFileSync(`${root}src/ui/fonts/${f}`)),
    ).toBe(true);
  }
});
