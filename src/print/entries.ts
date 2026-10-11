// Texto das entradas que não são referências: idiomas, endereço profissional,
// resumo e listas com período (formação, atuação, projetos…).

import { enumLabel } from '../labels/labels.ts';
import { getAttr, type XElement } from '../model/xml.ts';
import { formatPeriod, itemMeta } from '../ui/item-meta.ts';

const SKILLS: { attr: string; en: string; pt: string }[] = [
  { attr: 'PROFICIENCIA-DE-COMPREENSAO', en: 'understands', pt: 'compreende' },
  { attr: 'PROFICIENCIA-DE-FALA', en: 'speaks', pt: 'fala' },
  { attr: 'PROFICIENCIA-DE-LEITURA', en: 'reads', pt: 'lê' },
  { attr: 'PROFICIENCIA-DE-ESCRITA', en: 'writes', pt: 'escreve' },
];

const LEVELS: Record<string, { en: string; pt: string }> = {
  BEM: { en: 'well', pt: 'bem' },
  POUCO: { en: 'a little', pt: 'pouco' },
  RAZOAVELMENTE: { en: 'reasonably', pt: 'razoavelmente' },
};

/** "Inglês: compreende bem, fala bem, lê bem, escreve bem." */
export function languageLine(el: XElement, english: boolean): { detail: string; name: string } {
  const name = getAttr(el, 'DESCRICAO-DO-IDIOMA')?.trim() || getAttr(el, 'IDIOMA') || '';
  const detail = SKILLS.flatMap((s) => {
    const level = LEVELS[getAttr(el, s.attr) ?? ''];
    return level ? [`${english ? s.en : s.pt} ${english ? level.en : level.pt}`] : [];
  }).join(', ');
  return { detail, name };
}

/** Texto corrido de RESUMO-CV ou OUTRAS-INFORMACOES-RELEVANTES. */
export function paragraphText(el: XElement, english: boolean): string {
  if (el.name === 'RESUMO-CV') {
    const en = getAttr(el, 'TEXTO-RESUMO-CV-RH-EN')?.trim();
    return (english && en) || getAttr(el, 'TEXTO-RESUMO-CV-RH')?.trim() || '';
  }
  return el.attrs.map((a) => a.value.trim()).find(Boolean) ?? '';
}

/**
 * Endereço profissional (ENDERECO-PROFISSIONAL) em até três linhas:
 * instituição, lugar e página. O residencial, telefones e e-mails ficam fora
 * da página impressa.
 */
export function professionalAddress(prof: XElement): string[] {
  const v = (n: string) => getAttr(prof, n)?.trim() || undefined;
  const who = [v('NOME-INSTITUICAO-EMPRESA'), v('NOME-ORGAO'), v('NOME-UNIDADE')]
    .filter(Boolean)
    .join(', ');
  const cityUf = [v('CIDADE'), v('UF')].filter(Boolean).join(' – ');
  const where = [v('LOGRADOURO-COMPLEMENTO'), v('BAIRRO'), cityUf, v('CEP'), v('PAIS')]
    .filter(Boolean)
    .join(', ');
  return [who, where, v('HOME-PAGE')].filter((s): s is string => !!s);
}

export interface ListEntry {
  current: boolean;
  period: string;
  subtitle: string;
  title: string;
}

/** Período, título e linha de apoio de um item de lista. */
export function listEntry(el: XElement): ListEntry {
  const meta = itemMeta(el);
  const subtitle = meta.subtitle
    .split(' · ')
    .map((part) => (/^[A-Z_]+$/.test(part) ? enumLabel(part) : part))
    .join(', ');
  return { current: meta.current, period: formatPeriod(meta), subtitle, title: meta.title };
}

/** Itens em ordem decrescente de data (atuais primeiro), como na tela. */
export function newestFirst(items: XElement[]): XElement[] {
  return items
    .map((el, index) => ({ el, index, key: itemMeta(el).sortKey }))
    .sort((a, b) => b.key - a.key || a.index - b.index)
    .map((x) => x.el);
}
