// O caminho de contêineres da raiz até o pai de um elemento, pelo schema: o
// mais curto, partindo de CURRICULO-VITAE. Um tipo que aparece em mais de um
// lugar (a licença) fica no primeiro caminho mais curto.

import { lattesSchema } from '../../../schema/lattes.ts';

const cache = new Map<string, string[] | undefined>();

export function schemaPath(name: string): string[] | undefined {
  if (cache.has(name)) return cache.get(name);
  const seen = new Set<string>(['CURRICULO-VITAE']);
  let frontier: string[][] = [[]];
  let found: string[] | undefined;
  while (frontier.length > 0 && !found) {
    const next: string[][] = [];
    for (const path of frontier) {
      const parent = path.at(-1) ?? 'CURRICULO-VITAE';
      for (const c of lattesSchema.elements[parent]?.children ?? []) {
        if (c.name === name) {
          found = path;
          break;
        }
        if (seen.has(c.name)) continue;
        seen.add(c.name);
        next.push([...path, c.name]);
      }
      if (found) break;
    }
    frontier = next;
  }
  cache.set(name, found);
  return found;
}
