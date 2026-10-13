// A versão atual do currículo no Lattes, com o que ainda não foi enviado ao
// CNPq: a página de conferência `pkg_publicar.cv_espelho?f_cod=<10
// caracteres>&f_idioma=1`, a mesma do link "Versão em Português" da tela de
// envio (docs/lattes_internals.md, seção 10). Não pede código de segurança,
// ao contrário do currículo público.
//
// O que foi observado (12/10/2026, por leitura do texto da página): títulos
// de seção numa linha própria ("Produção", grafado "Producão" na página,
// "Eventos", "Totais de produção"), subtítulos logo antes do item 1 de cada
// lista ("Trabalhos técnicos", "Participação em eventos") e itens numerados
// "1. AUTOR; AUTOR. Título, 2005. (...)", seguidos de linhas de detalhe
// ("Palavras-chave: ...", "Referências adicionais: ..."). Como essas linhas
// se distribuem pelas tags HTML é inferido: o parser trabalha sobre o texto
// em linhas, não sobre classes ou ids da página.

import { foldText, htmlLines } from './html-text.ts';

export interface EspelhoItem {
  /** Subtítulo da lista ("Trabalhos técnicos"), quando há. */
  group?: string;
  /** Seção da página: "Produção" ou "Eventos". */
  section: string;
  /** A linha do item, sem o número. */
  text: string;
}

/**
 * Seções cujos itens numerados o editor compara com a exportação: só as que
 * foram vistas na página. Orientações e bancas devem ter o mesmo formato,
 * mas não foram observadas e ficam de fora.
 */
const COMPARED: Record<string, string> = { eventos: 'Eventos', producao: 'Produção' };

/** Títulos de seção vistos na página, para saber onde cada item está. */
const SECTIONS = new Set([
  'identificacao',
  'endereco',
  'formacao academica/titulacao',
  'formacao complementar',
  'atuacao profissional',
  'areas de atuacao',
  'idiomas',
  'premios e titulos',
  'producao',
  'eventos',
  'orientacoes',
  'bancas',
]);

/**
 * Outros títulos de seção, que não foram vistos nesta página mas existem no
 * currículo (os do menu do Lattes e do currículo público). Inferido: um
 * título assim encerra a seção comparada, para os itens numerados dele não
 * caírem em Produção ou Eventos.
 */
const OTHER_SECTION =
  /^(projetos?\b|patentes\b|inovacao\b|educacao e popularizacao\b|outras informacoes\b|citacoes\b|revisor de\b|membro de corpo editorial\b)/;

const END = 'totais de producao';
const ITEM = /^(\d+)\.\s+(.+)$/;

/** Itens numerados de Produção e Eventos, na ordem da página. */
export function parseEspelho(html: string): EspelhoItem[] {
  const items: EspelhoItem[] = [];
  let section: string | undefined;
  let group: string | undefined;
  let previous: string | undefined;
  for (const line of htmlLines(html)) {
    const key = foldText(line);
    if (key === END) break;
    if (SECTIONS.has(key) || OTHER_SECTION.test(key)) {
      section = key;
      group = undefined;
    } else {
      const m = ITEM.exec(line);
      if (m && section && COMPARED[section]) {
        // A numeração recomeça em 1 a cada lista; a linha anterior ao item 1 é o subtítulo.
        if (m[1] === '1') group = previous && !ITEM.test(previous) ? previous : undefined;
        items.push({ group, section: COMPARED[section]!, text: m[2]! });
      }
    }
    previous = line;
  }
  return items;
}

/** A página é mesmo a de conferência, e não o login ou um erro? */
export function isEspelhoPage(html: string): boolean {
  return /Este arquivo não foi gerado a partir do Currículo Lattes validado/i.test(
    htmlLines(html).join(' '),
  );
}
