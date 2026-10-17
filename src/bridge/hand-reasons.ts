// O porquê, para a pessoa, dos atributos do idioma que o formulário do Lattes
// não deixa alterar pelo conector (LAT-58). O vínculo está em
// atuacao-by-hand.ts.

import type { Change } from '../model/changes.ts';

/**
 * O idioma de uma linha é a chave dela no editor (a exportação não traz
 * número), e o nome segue o código.
 */
export function idiomaHandReason(change: Change): string | undefined {
  const attrs = new Set(change.fields.map((f) => f.attr));
  if (attrs.has('IDIOMA')) {
    return 'O idioma de uma linha não se troca pelo conector: inclua o idioma novo e exclua este';
  }
  if (attrs.has('DESCRICAO-DO-IDIOMA')) return 'O nome do idioma segue o código no Lattes';
  return undefined;
}
