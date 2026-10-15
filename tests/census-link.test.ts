import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { LOGON_REDIRECT } from '../scripts/lattes-simulado/html.ts';
import type { ServerOptions } from '../scripts/lattes-simulado/servidor.ts';
import type { ScannedField } from '../src/census/html-scan.ts';
import {
  bestItem,
  collectLinks,
  type FieldLink,
  finishLinks,
  itemValues,
  linkFields,
  matchScore,
} from '../src/census/link.ts';
import type { CensusPort } from '../src/census/run.ts';
import { decodeLatin1, encodeLatin1 } from '../src/model/latin1.ts';
import { element, parseXml, walk } from '../src/model/xml.ts';
import { withLattesSimulado } from './helpers/lattes-simulado.ts';

async function simulado(options: ServerOptions = {}) {
  const lattes = await withLattesSimulado(options);
  const port: CensusPort = {
    async get(path) {
      const res = await fetch(lattes.at(path));
      return {
        html: decodeLatin1(new Uint8Array(await res.arrayBuffer())),
        status: res.status,
        url: res.url,
      };
    },
    menuHtml: () => lattes.port.menuHtml(),
  };
  return { lattes, port };
}

const DEMO = decodeLatin1(new Uint8Array(readFileSync('fixtures/demo.xml')));

/** Um currículo sintético com dois trabalhos técnicos, para a lista que só o censo simula. */
const TECH_CV = `<?xml version="1.0" encoding="ISO-8859-1"?>
<CURRICULO-VITAE NUMERO-IDENTIFICADOR="0000000000000002"><DADOS-GERAIS NOME-COMPLETO="Pessoa Sintética"/>
<PRODUCAO-TECNICA>
<TRABALHO-TECNICO SEQUENCIA-PRODUCAO="7"><DADOS-BASICOS-DO-TRABALHO-TECNICO NATUREZA="PARECER" TITULO-DO-TRABALHO-TECNICO="Parecer sobre irrigação" ANO="2019" PAIS="Brasil" IDIOMA="Português" MEIO-DE-DIVULGACAO="MEIO_DIGITAL" FLAG-RELEVANCIA="NAO"/>
<DETALHAMENTO-DO-TRABALHO-TECNICO FINALIDADE="Avaliação" DURACAO-EM-MESES="3" CIDADE-DO-TRABALHO="Pelotas" INSTITUICAO-FINANCIADORA="Fundação Sintética"/></TRABALHO-TECNICO>
<TRABALHO-TECNICO SEQUENCIA-PRODUCAO="9"><DADOS-BASICOS-DO-TRABALHO-TECNICO NATUREZA="RELATORIO_TECNICO" TITULO-DO-TRABALHO-TECNICO="Relatório de solos" ANO="2021" PAIS="Alemanha" IDIOMA="Inglês" MEIO-DE-DIVULGACAO="IMPRESSO" FLAG-RELEVANCIA="SIM"/>
<DETALHAMENTO-DO-TRABALHO-TECNICO FINALIDADE="Diagnóstico" DURACAO-EM-MESES="12" CIDADE-DO-TRABALHO="Berlim" INSTITUICAO-FINANCIADORA="Agência Fictícia"/></TRABALHO-TECNICO>
</PRODUCAO-TECNICA></CURRICULO-VITAE>`;

const find = (links: FieldLink[], field: string, attribute: string) =>
  links.find((l) => l.field === field && l.attribute === attribute);

/** Os valores do currículo que não podem aparecer no resultado. */
function personalValues(xml: string): string[] {
  const out: string[] = [];
  walk(parseXml(xml).root, (el) => {
    for (const a of el.attrs)
      if (a.value.length >= 6 && !/^[A-Z_]+$/.test(a.value)) out.push(a.value);
  });
  return out;
}

describe('censo, passada de edição', () => {
  it('casa os campos dos formulários de edição com a exportação e não guarda valores', async () => {
    const { lattes, port } = await simulado();
    try {
      const { links, summary } = await linkFields(port, lattes.state.code, DEMO, { delayMs: 0 });
      expect(lattes.state.log.every((l) => l.method === 'GET')).toBe(true);
      const evento = summary.find((s) => s.target === 'evento')!;
      expect(evento).toMatchObject({ ambiguous: 0, status: 'ok' });
      expect(evento.matched).toBeGreaterThan(0);
      expect(find(links, 'f_nme_evento', 'NOME-DO-EVENTO')).toMatchObject({
        by: 'valor',
        conflicts: 0,
        target: 'evento',
      });
      expect(find(links, 'F_FORMA', 'FORMA-PARTICIPACAO')?.by).toBe('valor');
      expect(find(links, 'f_seq', 'SEQUENCIA-PRODUCAO')?.matches).toBe(evento.matched);
      expect(summary.find((s) => s.target === 'vinculo')?.status).toBe('ok');
      expect(summary.find((s) => s.target === 'licenca')?.status).toBe('sem-itens');
      const text = JSON.stringify({ links, summary });
      for (const value of personalValues(DEMO)) expect(text).not.toContain(value);
    } finally {
      await lattes.close();
    }
  });

  it('opção ↔ valor enumerado: o mapa só com códigos do Lattes e valores do XSD', async () => {
    const { lattes, port } = await simulado({ xml: encodeLatin1(TECH_CV) });
    try {
      const { links, summary } = await linkFields(port, lattes.state.code, TECH_CV, {
        delayMs: 0,
        only: ['trabalho-tecnico'],
      });
      expect(summary).toEqual([
        { ambiguous: 0, matched: 2, read: 2, status: 'ok', target: 'trabalho-tecnico' },
      ]);
      expect(find(links, 'f_titulo', 'TITULO-DO-TRABALHO-TECNICO')?.matches).toBe(2);
      expect(find(links, 'f_pais', 'PAIS')).toMatchObject({
        by: 'valor',
        matches: 2,
        spelling: { rotulo: 2 },
      });
      // "meio digital" é MEIO_DIGITAL: o rótulo da opção bate com o valor do XML.
      expect(find(links, 'f_meio', 'MEIO-DE-DIVULGACAO')).toMatchObject({
        by: 'valor',
        matches: 2,
      });
      expect(find(links, 'F_COD_PROD', 'NATUREZA')).toMatchObject({
        by: 'valor',
        matches: 2,
        // PARECER no XML, "Parecer" no rótulo: só sem caixa.
        spelling: { dobrado: 2 },
      });
      expect(find(links, 'f_inst', 'INSTITUICAO-FINANCIADORA')?.matches).toBe(2);
      const text = JSON.stringify(links);
      for (const value of personalValues(TECH_CV)) expect(text).not.toContain(value);
    } finally {
      await lattes.close();
    }
  });

  it('sessão caída para tudo; erro de rede marca só a entrada', async () => {
    const { lattes, port } = await simulado({ xml: encodeLatin1(TECH_CV) });
    try {
      const failing: CensusPort = { ...port, get: () => Promise.reject(new Error('rede')) };
      const { summary } = await linkFields(failing, lattes.state.code, TECH_CV, {
        delayMs: 0,
        only: ['trabalho-tecnico', 'resumo'],
      });
      expect(summary.map((s) => [s.target, s.status])).toEqual([
        ['resumo', 'sem-itens'],
        ['trabalho-tecnico', 'erro'],
      ]);
      const lost: CensusPort = {
        ...port,
        get: async () => ({ html: LOGON_REDIRECT, status: 200, url: '' }),
      };
      await expect(
        linkFields(lost, lattes.state.code, TECH_CV, { delayMs: 0, only: ['trabalho-tecnico'] }),
      ).rejects.toThrow('sessão');
    } finally {
      await lattes.close();
    }
  });
});

const field = (name: string, value: string, options?: ScannedField['options']): ScannedField => ({
  disabled: false,
  inHiddenBlock: false,
  label: '',
  name,
  options,
  readOnly: false,
  type: options ? 'radio' : 'text',
  value,
});

describe('censo, casamento de itens', () => {
  const a = element('PREMIO-TITULO', {
    'ANO-DA-PREMIACAO': '2020',
    'NOME-DO-PREMIO-OU-TITULO': 'Prêmio A',
  });
  const b = element('PREMIO-TITULO', {
    'ANO-DA-PREMIACAO': '2020',
    'NOME-DO-PREMIO-OU-TITULO': 'Prêmio B',
  });

  it('o item de maior pontuação, só se único e acima de 1', () => {
    const fields = [field('f_titulo', 'prêmio a'), field('f_ano', '2020')];
    expect(matchScore(fields, itemValues(a))).toBe(2);
    expect(bestItem(fields, [a, b])).toBe(a);
    expect(bestItem([field('f_ano', '2020')], [a, b])).toBeUndefined();
    expect(bestItem([field('f_ano', '2020'), field('x', 'y')], [a])).toBeUndefined();
    const seq = element('X', { 'SEQUENCIA-PRODUCAO': '4' });
    expect(matchScore([], itemValues(seq), '4')).toBe(3);
    expect(bestItem([field('f_ano', '2020')], [a, b, seq], '4')).toBe(seq);
  });

  it('mapa de opções que muda entre itens conta contra', () => {
    const out = new Map<string, FieldLink>();
    const status = (v: string) => [field('F_X', v, [{ chosen: true, label: 'x', value: v }])];
    const item = (v: string) => [{ attribute: 'FLAG-BOLSA', element: 'MESTRADO', value: v }];
    collectLinks(out, 't', status('S'), [
      {
        attribute: 'MEIO-DE-DIVULGACAO',
        element: 'DADOS-BASICOS-DO-TRABALHO-TECNICO',
        value: 'IMPRESSO',
      },
    ]);
    collectLinks(out, 't', status('S'), [
      {
        attribute: 'MEIO-DE-DIVULGACAO',
        element: 'DADOS-BASICOS-DO-TRABALHO-TECNICO',
        value: 'FILME',
      },
    ]);
    collectLinks(out, 't', status('N'), item('NAO'));
    collectLinks(out, 't', [field('f_vazio', '')], item('SIM'));
    const [meio] = finishLinks(out);
    expect(meio).toMatchObject({
      by: 'enumeracao',
      conflicts: 1,
      matches: 1,
      valueMap: { S: 'IMPRESSO' },
    });
    // FLAG-BOLSA não tem enum no schema: texto diferente só conta contra.
    expect(finishLinks(out).some((l) => l.attribute === 'FLAG-BOLSA')).toBe(false);
  });
});
