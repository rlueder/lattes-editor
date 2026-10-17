// As grades da página de alteração de um projeto no Lattes simulado: a
// equipe, os financiadores, as produções e as orientações ligadas.
//
// Observado (seção 21 de docs/lattes_internals.md, no código do check()): a
// equipe vai em f_autores_l com as chaves c, l, t, tit e add; os
// financiadores em f_inst_l; as produções e orientações em f_producoes_l e
// f_orientacoes_l. Inferido, como na especificação do conector
// (src/bridge/production/targets/projetos.ts): os nomes dos vetores, a ordem
// das chaves de cada linha (l, c, t, tit, como no autorProvider das
// produções) e que o servidor grave a equipe como chegou. Os financiadores,
// as produções e as orientações aparecem no vetor de cada uma e o POST não
// as grava: o conector só envia quando elas estão vazias.

import { insertInSchemaOrder } from '../../src/model/schema-order.ts';
import { childElements, element, getAttr, type XElement } from '../../src/model/xml.ts';
import { lattesSchema } from '../../src/schema/lattes.ts';
import type { LattesState } from './estado.ts';
import type { SimRequest } from './pedido.ts';

type Row = Record<string, boolean | string>;

const ordered = (...entries: [string, boolean | string][]): Row => Object.fromEntries(entries);

const provider = (decl: string, rows: Row[]) =>
  `<script>\n${decl} = \n${JSON.stringify([...rows, {}])};\n</script>`;

const team = (projeto: XElement) => {
  const equipe = childElements(projeto, 'EQUIPE-DO-PROJETO')[0];
  return equipe ? childElements(equipe, 'INTEGRANTES-DO-PROJETO') : [];
};

const partsOf = (projeto: XElement, container: string) =>
  childElements(projeto, container).flatMap((c) => childElements(c));

/** Os quatro vetores da página de alteração do projeto. */
export function projectGridScripts(projeto: XElement | undefined): string {
  const members = projeto
    ? [...team(projeto)]
        .sort(
          (a, b) =>
            Number(getAttr(a, 'ORDEM-DE-INTEGRACAO') ?? 0) -
            Number(getAttr(b, 'ORDEM-DE-INTEGRACAO') ?? 0),
        )
        .map((m) =>
          ordered(
            ['l', getAttr(m, 'NOME-COMPLETO') ?? ''],
            ['c', getAttr(m, 'NRO-ID-CNPQ') ?? ''],
            ['t', getAttr(m, 'NOME-PARA-CITACAO') ?? ''],
            ['tit', getAttr(m, 'FLAG-RESPONSAVEL') === 'SIM' ? 's' : 'n'],
            ['editable', false],
            ['deletable', true],
          ),
        )
    : [];
  const linked = (container: string, attr: string) =>
    projeto ? partsOf(projeto, container).map((p) => ordered(['l', getAttr(p, attr) ?? ''])) : [];
  return [
    provider('var autorProvider', members),
    provider('var financiadorProvider', linked('FINANCIADORES-DO-PROJETO', 'NOME-INSTITUICAO')),
    provider('var producaoProvider', linked('PRODUCOES-CT-DO-PROJETO', 'TITULO-DA-PRODUCAO-CT')),
    provider('var orientacaoProvider', linked('ORIENTACOES', 'TITULO-ORIENTACAO')),
  ].join('\n');
}

/** Grava a equipe do POST no projeto, como chegou (l|c|t|tit por linha). */
export function applyProjectTeam(state: LattesState, projeto: XElement, req: SimRequest): void {
  const grid = req.get('f_autores_l');
  if (grid === undefined || grid === null) return;
  const equipe = state.ensure(projeto, 'EQUIPE-DO-PROJETO');
  equipe.children = equipe.children.filter(
    (c) => !(c.kind === 'element' && c.name === 'INTEGRANTES-DO-PROJETO'),
  );
  grid
    .split('@')
    .filter(Boolean)
    .forEach((line, i) => {
      const [l = '', c = '', t = '', tit = ''] = line.split('|');
      insertInSchemaOrder(
        lattesSchema,
        equipe,
        element('INTEGRANTES-DO-PROJETO', {
          'FLAG-RESPONSAVEL': tit === 's' ? 'SIM' : 'NAO',
          'NOME-COMPLETO': l,
          'NOME-PARA-CITACAO': t,
          'NRO-ID-CNPQ': c,
          'ORDEM-DE-INTEGRACAO': String(i + 1),
        }),
      );
    });
}
