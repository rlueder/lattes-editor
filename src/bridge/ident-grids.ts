// Os campos que o check() do formulário de identificação (prc_ident, lido em
// 18/10/2026) monta antes do envio e que a página carrega vazios ou como
// estavam: f_dados_grid, a grade do ORCID (provider2) pelo array2xml da
// página, com o recorte do endereço que ela faz; e f_nome_citacao, os nomes
// em citação da grade (providerDetNmeCit) juntados por ";", sem espaço em
// volta do ";" e sem repetidos. Sem o f_dados_grid, o Lattes recusa o envio
// inteiro (ORA-19032, observado em 18/10/2026).

import { array2xml } from './endereco-contatos.ts';
import { readProvider } from './production/grids.ts';

/** O substr do JavaScript: início negativo conta do fim, tamanho negativo dá vazio. */
function substr(s: string, start: number, length?: number): string {
  const from = start < 0 ? Math.max(s.length + start, 0) : start;
  if (length === undefined) return s.slice(from);
  return length <= 0 ? '' : s.slice(from, from + length);
}

/** O recorte que o check() faz no XML da grade do ORCID, passo a passo como na página. */
export function orcidCut(input: string): string {
  let xml = input;
  let inicut = xml.indexOf('https://orcid.org/');
  let xmltp = substr(xml, inicut);
  let fimcut = xmltp.indexOf('"');
  const vhttp = substr(xml, inicut, fimcut);
  inicut = xml.indexOf('<endereco>');
  xmltp = substr(xml, inicut);
  fimcut = xmltp.indexOf('</endereco>');
  const vtagend = substr(xml, inicut + 10, fimcut - 10);
  xml = xml.replace(vtagend, () => '');
  return xml.replace('<endereco></endereco>', () => `<endereco>${vhttp}</endereco>`);
}

function limpaEspacos(nome: string): string {
  let x = nome.trim();
  while (x.includes(' ;')) x = x.replace(' ;', ';');
  while (x.includes('; ')) x = x.replace('; ', ';');
  return x;
}

function retiraRepeticoes(nome: string): string {
  if (!nome.includes(';')) return nome;
  let out = '';
  for (const n of nome.split(';')) {
    if (!`;${out};`.includes(`;${n};`)) out += `${n};`;
  }
  return out.slice(0, -1);
}

/** Os dois campos como o check() os deixaria; undefined sem uma das grades na página. */
export function identGrids(
  html: string,
): { f_dados_grid: string; f_nome_citacao: string } | undefined {
  const orcid = readProvider(html, 'provider2');
  const names = readProvider(html, 'providerDetNmeCit');
  if (!orcid || !names) return undefined;
  const joined = names
    .filter((r) => r.l !== undefined)
    .map((r) => String(r.l))
    .join(';');
  return {
    f_dados_grid: orcidCut(array2xml(orcid)),
    f_nome_citacao: retiraRepeticoes(limpaEspacos(joined)),
  };
}
