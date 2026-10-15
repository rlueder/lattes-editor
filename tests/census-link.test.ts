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
  linkOnlyFile,
  matchScore,
} from '../src/census/link.ts';
import { coverage } from '../src/census/report.ts';
import type { CensusPort } from '../src/census/run.ts';
import { CENSUS_TARGETS } from '../src/census/targets-production.ts';
import { decodeLatin1, encodeLatin1 } from '../src/model/latin1.ts';
import { element, parseXml, walk } from '../src/model/xml.ts';
import { faults, withLattesSimulado } from './helpers/lattes-simulado.ts';

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
        expect.objectContaining({
          ambiguous: 0,
          listed: 2,
          matched: 2,
          read: 2,
          status: 'ok',
          target: 'trabalho-tecnico',
        }),
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
      // As grades do trabalho técnico: o simulado traz os ocultos vazios.
      const tech = summary[0]!;
      expect(tech.grids).toMatchObject({ f_autores_l: { empty: 2, filled: 0 } });
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

describe('censo, passada de edição sozinha', () => {
  it('vira um arquivo do censo sem formulários, e o relatório usa as ligações dele', async () => {
    const { lattes, port } = await simulado({ xml: encodeLatin1(TECH_CV) });
    try {
      const result = await linkFields(port, lattes.state.code, TECH_CV, {
        delayMs: 0,
        only: ['trabalho-tecnico'],
      });
      const file = linkOnlyFile(result, 'teste', () => new Date('2026-10-16T10:00:00Z'));
      expect(file).toMatchObject({
        capturedAt: '2026-10-16T10:00:00.000Z',
        entries: [],
        format: 1,
        linkSummary: result.summary,
        links: result.links,
        lists: {},
      });
      const cov = coverage({ files: [file], targets: CENSUS_TARGETS });
      expect(cov).toBeDefined();
    } finally {
      await lattes.close();
    }
  });
});

describe('censo, o que a lista diz além da exportação', () => {
  /** A demonstração sem os eventos: a exportação não os tem, o Lattes simulado tem. */
  const withoutEvents = DEMO.replace(
    /<PARTICIPACAO-EM-EVENTOS-CONGRESSOS>[\s\S]*?<\/PARTICIPACAO-EM-EVENTOS-CONGRESSOS>/,
    '',
  );

  it('item só na lista do Lattes: conta os links, sem abrir formulário', async () => {
    expect(withoutEvents).not.toContain('PARTICIPACAO-EM-CONGRESSO');
    const { lattes, port } = await simulado();
    try {
      const { links, summary } = await linkFields(port, lattes.state.code, withoutEvents, {
        delayMs: 0,
        only: ['evento'],
      });
      const evento = summary.find((s) => s.target === 'evento')!;
      expect(evento.status).toBe('so-na-lista');
      expect(evento.listed).toBeGreaterThan(0);
      expect(evento.read).toBe(0);
      expect(links).toEqual([]);
      expect(lattes.state.log.some((l) => /^pkg_evento\.form$/i.test(l.proc))).toBe(false);
    } finally {
      await lattes.close();
    }
  });

  it('o limite de itens lidos aparece: listed maior que read', async () => {
    const { lattes, port } = await simulado();
    try {
      const { summary } = await linkFields(port, lattes.state.code, DEMO, {
        delayMs: 0,
        maxItems: 1,
        only: ['evento'],
      });
      const evento = summary.find((s) => s.target === 'evento')!;
      expect(evento.read).toBe(1);
      expect(evento.listed).toBeGreaterThan(1);
    } finally {
      await lattes.close();
    }
  });

  it('lista sem link de edição reconhecível: sem-link, com a forma da página e sem valores', async () => {
    // A lista passa a abrir o formulário por uma função da página, como a grade
    // de atividades da atuação (seção 8 de lattes_internals.md).
    const { lattes, port } = await simulado({
      intercept: faults.rewritePages(/^pkg_evento\.lista$/i, (html) =>
        html
          .replace(/setarUrl\('PKG_EVENTO\.form\?[^']*f_seq=(\d+)',true\)/g, 'abre($1)')
          .replace(
            '</body>',
            "<script>function abre(n){ go('PKG_EVENTO.form', n); }</script></body>",
          ),
      ),
    });
    try {
      const { summary } = await linkFields(port, lattes.state.code, DEMO, {
        delayMs: 0,
        only: ['evento'],
      });
      const evento = summary.find((s) => s.target === 'evento')!;
      expect(evento).toMatchObject({ listed: 0, read: 0, status: 'sem-link' });
      expect(evento.listShape!.mentions).toBeGreaterThan(0);
      // O "Incluir novo item" segue como link, e só os nomes dos parâmetros ficam.
      expect(evento.listShape!.procs).toContain(
        'PKG_EVENTO.form?f_cod&f_sta_divulgacao_cientifica',
      );
      expect(JSON.stringify(evento)).not.toContain(lattes.state.code);
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
