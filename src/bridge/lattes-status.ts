// O estado do currículo no Lattes, lido do menu (PKG_MENU.menu) que já está
// aberto na aba da pessoa, sem requisição nova: a data da última publicação
// e se há alteração ainda não enviada ao CNPq. Ver docs/lattes_internals.md,
// seção 10, e docs/fluxos_de_uso.md.
//
// Os textos procurados foram vistos no menu em 12/10/2026 ("Última
// publicação: 17/08/2026" no topo e o aviso "Existem alterações realizadas
// em seu currículo que ainda não foram enviadas ao CNPq"). Que o aviso some
// depois de "Enviar ao CNPq" é inferido, não observado.

export interface LattesStatus {
  /** Data da última publicação, AAAA-MM-DD. */
  lastPublished?: string;
  /** O menu mostra o aviso de alterações não enviadas ao CNPq. */
  pending: boolean;
}

const ENTITIES: Record<string, string> = {
  aacute: 'á',
  atilde: 'ã',
  ccedil: 'ç',
  eacute: 'é',
  iacute: 'í',
  nbsp: ' ',
  oacute: 'ó',
  otilde: 'õ',
  Uacute: 'Ú',
  uacute: 'ú',
};

/** Texto do HTML: sem scripts, estilos e tags, com as entidades do Latin-1 resolvidas. */
function plainText(html: string): string {
  return html
    .replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&(\w+);/g, (m, name: string) => ENTITIES[name] ?? m)
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)))
    .replace(/\s+/g, ' ');
}

export function lattesStatusFrom(html: string): LattesStatus {
  const text = plainText(html);
  const date = /Última publicação:?\s*(\d{2})\/(\d{2})\/(\d{4})/i.exec(text);
  return {
    lastPublished: date ? `${date[3]}-${date[2]}-${date[1]}` : undefined,
    pending: /ainda não foram enviadas ao CNPq/i.test(text),
  };
}

/**
 * Dito uma vez no fim de cada fila com algo conferido, no editor e no painel
 * da extensão: o que a ponte grava fica pendente até a pessoa publicar.
 */
export const PUBLISH_REMINDER =
  'Ainda não está no currículo público. No Lattes, clique em "Enviar", no canto superior direito, e depois em "Enviar ao CNPq". Até lá, o Lattes não exporta o currículo.';
