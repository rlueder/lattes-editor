// Qual página de item de teste se exclui, e como (censo-test-items.ts).
// Saiu de uma revisão antes da limpeza de 18/10/2026: a regra antiga
// aceitava a marca em qualquer lugar do HTML da página.

import { matchesCreated, TEST_MARK } from '../../src/census/test-plan.ts';

/**
 * Se a página é de um item de teste, e como excluí-lo. A marca tem de estar
 * num campo do próprio item: a página de uma atuação lista as atividades de
 * dentro dela, e a marca de uma atividade de teste ali não faz da atuação um
 * item de teste. A atuação só sai inteira (dele(), que apaga atividades,
 * vínculos e projetos) quando todos os vínculos dela são de teste.
 */
export function removal(
  path: string,
  html: string,
  created: { values: Record<string, string> }[],
): 'atuacao' | 'item' | undefined {
  if (/cargos_vinculos/i.test(path)) {
    const bonds = new Set([...html.matchAll(/f_seq_hist=(\d+)/g)].map((m) => m[1]));
    const doc = new DOMParser().parseFromString(html, 'text/html');
    doc.querySelectorAll('script, style').forEach((el) => el.remove());
    const marks = (doc.body?.textContent ?? '').split(TEST_MARK).length - 1;
    return bonds.size > 0 && marks >= bonds.size && /function dele\(/.test(html)
      ? 'atuacao'
      : undefined;
  }
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const own = [...doc.forms].some(
    (form) =>
      !!form.elements.namedItem('f_ctr') &&
      [...form.elements].some((el) => {
        const field = el as HTMLInputElement;
        // As listas de outros itens (_l) levam nomes de itens relacionados.
        return !/_l\d?$/.test(field.name) && (field.value ?? '').includes(TEST_MARK);
      }),
  );
  if (own) return 'item';
  return created.some((r) => matchesCreated(html, r.values)) ? 'item' : undefined;
}

/** O título visível de uma página de item, para o ensaio da remoção. */
export function pageTitle(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const field = doc.querySelector<HTMLInputElement>(
    'input[name=f_titulo], input[name=f_enqua], input[name=f_inst], textarea',
  );
  return (field?.value ?? '').slice(0, 60);
}
