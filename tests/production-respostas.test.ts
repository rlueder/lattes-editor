// O que o Lattes devolve no lugar da gravação: o erro do banco (ORA-…), que a
// própria página do Lattes mostra ao salvar um trabalho que entrou pelo
// Importar (28/10/2026), e o campo que a página de alteração não mostra
// depois de gravar (o acervo da manutenção de obra artística).

import { afterEach, describe, expect, it } from 'vitest';

import { html } from '../scripts/lattes-simulado/tipos.ts';
import { applyOp } from '../src/bridge/apply.ts';
import { lattesDbError } from '../src/bridge/lattes-html.ts';
import { planChanges } from '../src/bridge/plan.ts';
import { diffDocuments } from '../src/model/changes.ts';
import { encodeLatin1 } from '../src/model/latin1.ts';
import { parseXml, setAttr, type XElement } from '../src/model/xml.ts';
import {
  findIn,
  type LattesSimuladoNoTeste,
  withLattesSimulado,
} from './helpers/lattes-simulado.ts';

const XML = `<CURRICULO-VITAE NUMERO-IDENTIFICADOR="1"><DADOS-GERAIS NOME-COMPLETO="Pessoa Sintética" NOME-EM-CITACOES-BIBLIOGRAFICAS="SINTÉTICA, P."/>
<PRODUCAO-TECNICA><DEMAIS-TIPOS-DE-PRODUCAO-TECNICA><MANUTENCAO-DE-OBRA-ARTISTICA SEQUENCIA-PRODUCAO="5"><DADOS-BASICOS-DE-MANUTENCAO-DE-OBRA-ARTISTICA TIPO="CONSERVACAO" NATUREZA="DESENHO" TITULO="Obra de Exemplo" ANO="2020" PAIS="Brasil" IDIOMA="Português" FLAG-RELEVANCIA="NAO" DOI="" TITULO-INGLES=""/><DETALHAMENTO-DE-MANUTENCAO-DE-OBRA-ARTISTICA NOME-DA-OBRA="Obra" AUTOR-DA-OBRA="Autor" ANO-DA-OBRA="1900" ACERVO="PUBLICO" LOCAL="Museu" CIDADE="Porto Alegre"/><AUTORES NOME-COMPLETO-DO-AUTOR="Pessoa Sintética" NOME-PARA-CITACAO="SINTÉTICA, P." ORDEM-DE-AUTORIA="1" NRO-ID-CNPQ=""/></MANUTENCAO-DE-OBRA-ARTISTICA></DEMAIS-TIPOS-DE-PRODUCAO-TECNICA></PRODUCAO-TECNICA></CURRICULO-VITAE>`;

let open: LattesSimuladoNoTeste | undefined;
afterEach(async () => {
  await open?.close();
  open = undefined;
});

const byName = (root: XElement, name: string) => findIn(root, (el) => el.name === name)!;

function onlyOp(edit: (root: XElement) => void) {
  const original = parseXml(XML).root;
  const working = parseXml(XML).root;
  edit(working);
  const plan = planChanges(
    diffDocuments(original, working).map((change) => ({ change, itemTitle: 'Obra' })),
    working,
    { editProduction: true },
  );
  expect(plan.unsupported).toEqual([]);
  return plan.ops[0]!;
}

describe('respostas do Lattes à gravação', () => {
  it('o erro do banco: só o primeiro código, com a mensagem', () => {
    expect(
      lattesDbError(
        '<html><body>Erro. ORA-01403: não foram encontrados dados ORA-01403: não foram encontrados dados ORA-06512: na "FOMENTO.X", linha 34</body></html>',
      ),
    ).toBe('ORA-01403: não foram encontrados dados');
    expect(lattesDbError('<html><body>ok</body></html>')).toBeUndefined();
  });

  it('a gravação recusada pelo banco diz o erro, e não "não gravou"', async () => {
    open = await withLattesSimulado({
      intercept: async (req, _state, next) =>
        req.method === 'POST'
          ? html(
              '<html><head></head><body>Erro. ORA-01403: não foram encontrados dados ORA-06512: na "FOMENTO.PKG"</body></html>',
            )
          : next(),
      xml: encodeLatin1(`<?xml version="1.0" encoding="ISO-8859-1"?>\n${XML}`),
    });
    const op = onlyOp((root) =>
      setAttr(byName(root, 'DETALHAMENTO-DE-MANUTENCAO-DE-OBRA-ARTISTICA'), 'LOCAL', 'Outro museu'),
    );
    const r = await applyOp(op, open.port);
    expect(r.status).toBe('divergente');
    expect(r.detail).toBe('O Lattes recusou a gravação: ORA-01403: não foram encontrados dados');
  });

  it('o acervo vai sem conferir, com o aviso de conferir na exportação', async () => {
    open = await withLattesSimulado({
      xml: encodeLatin1(`<?xml version="1.0" encoding="ISO-8859-1"?>\n${XML}`),
    });
    const op = onlyOp((root) =>
      setAttr(byName(root, 'DETALHAMENTO-DE-MANUTENCAO-DE-OBRA-ARTISTICA'), 'ACERVO', 'PRIVADO'),
    );
    expect(op.set).toEqual({ f_acervo: 'Privado' });
    const r = await applyOp(op, open.port);
    expect(r.status).toBe('conferido');
    expect(r.detail).toMatch(/não mostra Acervo depois de gravar: confira na exportação$/);
  });
});
