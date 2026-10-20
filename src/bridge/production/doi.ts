// O DOI de uma produção bibliográfica, no oculto f_cod_doi (no capítulo, um
// campo de texto). Lido em 20/10/2026 nas páginas de edição e de inclusão do
// Lattes real: o botão ao lado do campo só recupera os dados da produção pelo
// DOI, e o que o Salvar grava é o texto do campo. Antes de enviar, o check()
// de cada página confere:
//
// - o formato: começa por "10." e tem uma "/" (todas);
// - se o DOI já está em outra produção do currículo:
//   pkg_artigo.verifica_doi_duplicado (POST f_doi, f_cod, f_seq), que responde
//   "doiDup = 0" ou "doiDup = 1" (artigos, trabalho em eventos e livro);
// - o tipo do DOI: pkg_artigo.tipodoi (POST fcod, ffun), que responde o tipo
//   por extenso (ARTIGO, LIVRO, CAPITULO, INEXISTENTE para o que não acha) ou
//   vazio; o artigo quer um que comece por A, o trabalho em eventos por T (o
//   livro tem a conferência comentada; o capítulo não tem). Sem o ffun, mesmo
//   vazio, a resposta é um 404.
//
// O conector faz as mesmas perguntas antes do POST e para no que o check()
// recusaria, sem enviar nada.

import type { LattesPort } from '../apply.ts';
import { encodeLatin1Form } from '../form.ts';
import { latin1Param } from '../lattes-lists.ts';

export interface DoiSpec {
  /** Conferir se o DOI já está em outra produção do currículo. */
  duplicate: boolean;
  /** A letra que o tipo do DOI tem de ter, e o ffun que a página manda. */
  type?: { ffun?: string; letter: string; label: string };
}

export const isDoiFormat = (doi: string) => /^10\..*\//.test(doi);

/** O código do currículo e a sequência que a página manda na conferência de duplicado. */
export function duplicateArgs(html: string): { cod: string; seq: string } | undefined {
  const m =
    /vefificaDoiCadastrado\(\s*trim\(\s*dc\.f_cod_doi\.value\s*\)\s*,\s*"([^"]*)"\s*,\s*"([^"]*)"\s*\)/.exec(
      html,
    );
  return m ? { cod: m[1]!, seq: m[2]! } : undefined;
}

/** O motivo de o DOI não ir, como o check() da página o recusaria; undefined se vai. */
export async function doiProblem(
  doi: string,
  spec: DoiSpec,
  html: string,
  port: LattesPort,
): Promise<string | undefined> {
  if (!isDoiFormat(doi))
    return `O DOI ${doi} é inválido: o Lattes pede um que comece por "10." e tenha "/"`;
  if (spec.type) {
    // O jQuery da página codifica de novo o que o escape() já codificou, e
    // manda o ffun mesmo vazio: sem ele o Lattes responde 404.
    const kind = (
      await port.post(
        'pkg_artigo.tipodoi',
        encodeLatin1Form([
          ['fcod', latin1Param(doi)],
          ['ffun', spec.type.ffun ?? ''],
        ]),
      )
    ).trim();
    if (!/^[A-Z_ ]*$/.test(kind)) return 'O Lattes não respondeu o tipo do DOI; nada foi enviado';
    if (kind === 'INEXISTENTE') return `O Lattes não acha o DOI ${doi}`;
    if (kind && kind[0] !== spec.type.letter) {
      return `O DOI ${doi} não é de ${spec.type.label}: o Lattes diz que é de ${kind.toLowerCase()}`;
    }
  }
  if (spec.duplicate) {
    const args = duplicateArgs(html);
    if (!args)
      return 'A página do Lattes não trouxe a conferência de DOI duplicado; nada foi enviado';
    const answer = await port.post(
      'pkg_artigo.verifica_doi_duplicado',
      encodeLatin1Form([
        ['f_doi', doi],
        ['f_cod', args.cod],
        ['f_seq', args.seq],
      ]),
    );
    if (/doiDup\s*=\s*1/.test(answer)) return `O DOI ${doi} já está em outra produção do currículo`;
    if (!/doiDup\s*=\s*0/.test(answer)) {
      return 'O Lattes não respondeu se o DOI já está no currículo; nada foi enviado';
    }
  }
  return undefined;
}
