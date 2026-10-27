// Contatos do endereço (src/bridge/endereco-contatos.ts e o endereço em
// dados-gerais-edit.ts): e-mails e redes sociais, e as grades que todo envio
// do formulário de endereço leva, contra o Lattes simulado.

import { afterEach, describe, expect, it } from 'vitest';

import type { Intercept } from '../scripts/lattes-simulado/servidor.ts';
import { applyOp } from '../src/bridge/apply.ts';
import { array2xml, sameSocialPrivacy, socialGrid } from '../src/bridge/endereco-contatos.ts';
import { type BridgeOp, planChanges } from '../src/bridge/plan.ts';
import { diffDocuments } from '../src/model/changes.ts';
import { replaceContactValue } from '../src/model/contact-edit.ts';
import { encodeLatin1 } from '../src/model/latin1.ts';
import { getAttr, parseXml, setAttr, type XElement } from '../src/model/xml.ts';
import {
  findIn,
  type LattesSimuladoNoTeste,
  postsOf,
  withLattesSimulado,
} from './helpers/lattes-simulado.ts';

const LINKEDIN =
  'ID Rede Social: 1000001, Nome Rede Social: Linkedin, Endereço: https://example.org/pessoa/';

const XML = `<CURRICULO-VITAE NUMERO-IDENTIFICADOR="1"><DADOS-GERAIS NOME-COMPLETO="Pessoa de Teste">
<ENDERECO FLAG-DE-PREFERENCIA="ENDERECO_INSTITUCIONAL" REDE-SOCIAL="${LINKEDIN}" ELETRONICO="I: pessoa@example.org" OUTRA-FORMA-DE-CONTATO="">
<ENDERECO-PROFISSIONAL NOME-INSTITUICAO-EMPRESA="Universidade" LOGRADOURO-COMPLEMENTO="Rua A, 1" PAIS="Brasil" UF="RS" CEP="90000000" CIDADE="Porto Alegre" BAIRRO="Centro" DDD="51" TELEFONE="33330000" RAMAL="" FAX="" CAIXA-POSTAL="" E-MAIL="pessoa@example.org" HOME-PAGE=""/>
</ENDERECO></DADOS-GERAIS></CURRICULO-VITAE>`;

const byName = (root: XElement, name: string) => findIn(root, (el) => el.name === name)!;

function plan(edit: (root: XElement) => void, xml = XML) {
  const original = parseXml(xml).root;
  const working = parseXml(xml).root;
  edit(working);
  return planChanges(
    diffDocuments(original, working).map((change) => ({ change, itemTitle: '' })),
    working,
    { biographicFull: true, biographicOps: true },
  );
}

const onlyOp = (edit: (root: XElement) => void): BridgeOp => {
  const p = plan(edit);
  expect(p.unsupported).toEqual([]);
  return p.ops[0]!;
};

const set = (name: string, attr: string, value: string) => (root: XElement) =>
  setAttr(byName(root, name), attr, value);

let open: LattesSimuladoNoTeste | undefined;
afterEach(async () => {
  await open?.close();
  open = undefined;
});

async function lattes(intercept?: Intercept) {
  open = await withLattesSimulado({
    intercept,
    xml: encodeLatin1(`<?xml version="1.0" encoding="ISO-8859-1"?>\n${XML}`),
  });
  return open;
}

const GITHUB = `${LINKEDIN}; ID Rede Social: 1000002, Nome Rede Social: GitHub, Endereço: https://github.com/exemplo`;

describe('contatos do endereço: o plano', () => {
  it.each([
    ['ELETRONICO', 'texto que não é um e-mail'],
    ['ELETRONICO', 'I: novo@example.org; trecho desconhecido'],
    ['ELETRONICO', 'I: novo@example.org; I: duplicado@example.org'],
    ['REDE-SOCIAL', `${LINKEDIN}; trecho desconhecido`],
    ['REDE-SOCIAL', `${LINKEDIN}; ${LINKEDIN}`],
  ])('não confunde %s parcialmente reconhecido com uma lista vazia ou completa', (attr, value) => {
    const result = plan(set('ENDERECO', attr!, value!));
    expect(result.ops).toEqual([]);
    expect(result.unsupported).toHaveLength(1);
  });

  it('também recusa um valor anterior não reconhecido, antes de tentar limpar', () => {
    const unknown = XML.replace('I: pessoa@example.org', 'texto desconhecido');
    const result = plan(set('ENDERECO', 'ELETRONICO', ''), unknown);
    expect(result.ops).toEqual([]);
    expect(result.unsupported).toHaveLength(1);
  });

  it('vazio explícito continua sendo uma limpeza intencional de contatos reconhecidos', () => {
    expect(onlyOp(set('ENDERECO', 'ELETRONICO', ''))).toMatchObject({
      set: { f_email_i: '', f_email_r: '' },
    });
    expect(onlyOp(set('ENDERECO', 'REDE-SOCIAL', ''))).toMatchObject({ social: { after: [] } });
  });
  it('a rede nova vira a lista de redes antes e depois', () => {
    expect(onlyOp(set('ENDERECO', 'REDE-SOCIAL', GITHUB))).toMatchObject({
      kind: 'endereco',
      social: {
        after: [
          { name: 'LinkedIn', url: 'https://example.org/pessoa/' },
          { name: 'GitHub', url: 'https://github.com/exemplo' },
        ],
        before: [{ name: 'LinkedIn', url: 'https://example.org/pessoa/' }],
      },
    });
  });

  it('os e-mails vão nos dois campos de texto, o alternativo pelo R', () => {
    expect(
      onlyOp(set('ENDERECO', 'ELETRONICO', 'I: novo@example.org; R: outro@example.org')),
    ).toMatchObject({
      expect: { f_email_i: 'pessoa@example.org', f_email_r: '' },
      set: { f_email_i: 'novo@example.org', f_email_r: 'outro@example.org' },
    });
    expect(plan(set('ENDERECO', 'ELETRONICO', 'novo@example.org')).unsupported[0]?.reason).toMatch(
      /para contato \(I:\) ou alternativo \(R:\)/,
    );
    expect(plan(set('ENDERECO', 'OUTRA-FORMA-DE-CONTATO', 'x')).unsupported[0]?.reason).toMatch(
      /nunca foi vista/,
    );
  });
});

describe('contatos do endereço: as grades como a página as manda', () => {
  it('compara também IDs e privacidade, mantendo duplicatas e ignorando só a ordem', () => {
    const first = { endereco: 'u', id: 1, privacidade: '2', redeSocial: 'Linkedin' };
    const second = { endereco: 'g', id: 2, privacidade: '1', redeSocial: 'GitHub' };
    expect(sameSocialPrivacy([first, second, {}], [second, first])).toBe(true);
    expect(sameSocialPrivacy([first], [{ ...first, id: 3 }])).toBe(false);
    expect(sameSocialPrivacy([first], [{ ...first, privacidade: '1' }])).toBe(false);
    expect(sameSocialPrivacy([first, first], [first])).toBe(false);
  });
  it('array2xml como o da página: item por linha, a linha em branco some', () => {
    expect(array2xml([{ id: 2, endereco: 'a<b&c', redeSocial: 'Linkedin' }, {}])).toBe(
      '<root><item>\n\t<id>2</id>\n\t<endereco>a&amp;lt;b&amp;c</endereco>\n\t<redeSocial>Linkedin</redeSocial>\n</item >\n</root >',
    );
    expect(array2xml([{}])).toBe('<root></root >');
  });

  it('a rede que já estava fica com a linha dela; a nova sai da lista de tipos', () => {
    const current = [
      { endereco: 'u', id: 2, privacidade: '2', redeSocial: 'Linkedin', visibilidade: 'Privado' },
      {},
    ];
    const types = [{ id: 15, redeSocial: 'GitHub' }];
    const out = socialGrid(current, types, [
      { name: 'LinkedIn', url: 'u' },
      { name: 'GitHub', url: 'g' },
    ]);
    expect(out).toEqual({
      rows: [
        current[0],
        {
          endereco: 'g',
          id: '15',
          privacidade: '1',
          redeSocial: 'GitHub',
          visibilidade: 'Público',
        },
        {},
      ],
    });
    expect(Object.keys((out as { rows: object[] }).rows[1]!)).toEqual([
      'id',
      'redeSocial',
      'endereco',
      'privacidade',
      'visibilidade',
    ]);
    expect(socialGrid(current, types, [{ name: 'Orkut', url: 'x' }])).toEqual({ unknown: 'Orkut' });
  });

  it('trocar a URL de uma rede privada preserva id, visibilidade e chaves desconhecidas', () => {
    const existing = {
      endereco: 'https://example.org/antes',
      extra: 'preservado',
      id: 2,
      privacidade: '2',
      redeSocial: 'Linkedin',
      visibilidade: 'Privado',
    };
    const out = socialGrid(
      [existing, { id: '' }],
      [],
      [{ name: 'LinkedIn', url: 'https://example.org/depois' }],
    );
    expect(out).toEqual({ rows: [{ ...existing, endereco: 'https://example.org/depois' }, {}] });
    expect(existing.endereco).toBe('https://example.org/antes');
  });

  it('outro perfil na mesma rede, com o de antes intacto, é uma inclusão', () => {
    const existing = {
      endereco: 'https://example.org/a',
      id: 2,
      privacidade: '2',
      redeSocial: 'Linkedin',
      visibilidade: 'Privado',
    };
    const out = socialGrid(
      [existing, { id: '' }],
      [{ id: 3, redeSocial: 'Linkedin' }],
      [
        { name: 'LinkedIn', url: 'https://example.org/a' },
        { name: 'LinkedIn', url: 'https://example.org/b' },
      ],
    );
    expect(out).toEqual({
      rows: [
        existing,
        {
          endereco: 'https://example.org/b',
          id: '3',
          privacidade: '1',
          redeSocial: 'Linkedin',
          visibilidade: 'Público',
        },
        {},
      ],
    });
  });

  it('duas linhas da mesma rede não permitem adivinhar qual privacidade manter', () => {
    expect(
      socialGrid(
        [
          { endereco: 'a', id: 2, privacidade: '1', redeSocial: 'Linkedin' },
          { endereco: 'b', id: 2, privacidade: '2', redeSocial: 'Linkedin' },
        ],
        [{ id: 2, redeSocial: 'Linkedin' }],
        [{ name: 'LinkedIn', url: 'c' }],
      ),
    ).toEqual({ ambiguous: 'LinkedIn' });
  });
});

describe('contatos do endereço: o envio', () => {
  it.each([false, true])(
    'a privacidade da rede continua privada depois da troca: %s',
    async (kept) => {
      let posted = false;
      const sim = await lattes(async (req, _state, next) => {
        if (req.proc.toLowerCase() === 'prc_endereco' && req.method === 'POST') posted = true;
        const response = await next();
        if (
          req.proc.toLowerCase() === 'prc_endereco' &&
          req.method === 'GET' &&
          (!posted || kept) &&
          'html' in response
        ) {
          return {
            ...response,
            html: response.html.replaceAll('"privacidade":"1"', '"privacidade":"2"'),
          };
        }
        return response;
      });
      const edited = replaceContactValue(
        LINKEDIN,
        'REDE-SOCIAL',
        0,
        'https://example.org/privado',
      )!;
      const result = await applyOp(onlyOp(set('ENDERECO', 'REDE-SOCIAL', edited)), sim.port);
      expect(postsOf(sim)[0]!.fields.f_dados_grid).toContain('<privacidade>2</privacidade>');
      expect(result.status).toBe(kept ? 'conferido' : 'divergente');
    },
  );
  it.each([
    ['ELETRONICO', 'novo@example.org'],
    ['REDE-SOCIAL', 'https://example.org/novo'],
  ])('a edição de %s pelo controle gera uma operação que volta conferida', async (attr, next) => {
    const sim = await lattes();
    const original = getAttr(byName(parseXml(XML).root, 'ENDERECO'), attr!)!;
    const edited = replaceContactValue(original, attr!, 0, next!)!;
    const op = onlyOp(set('ENDERECO', attr!, edited));
    expect(await applyOp(op, sim.port)).toMatchObject({ status: 'conferido' });
    if (attr === 'ELETRONICO') {
      expect(postsOf(sim)[0]!.fields.f_email_i).toBe(next);
      expect(getAttr(byName(sim.state.root, 'ENDERECO-PROFISSIONAL'), 'E-MAIL')).toBe(next);
    } else {
      expect(getAttr(byName(sim.state.root, 'ENDERECO'), attr!)).toContain(next);
    }
    expect(postsOf(sim)).toHaveLength(1);
  });
  it('outra troca no endereço manda as redes de volta, sem apagá-las', async () => {
    const sim = await lattes();
    const op = onlyOp(set('ENDERECO-PROFISSIONAL', 'BAIRRO', 'Bom Fim'));
    expect(await applyOp(op, sim.port)).toMatchObject({ status: 'conferido' });
    expect(getAttr(byName(sim.state.root, 'ENDERECO'), 'REDE-SOCIAL')).toMatch(/Linkedin/);
    expect(postsOf(sim).at(-1)?.fields.f_dados_grid).toMatch(/<redeSocial>Linkedin<\/redeSocial>/);
  });

  it('uma rede nova entra pela grade e a releitura confere a lista', async () => {
    const sim = await lattes();
    const op = onlyOp(set('ENDERECO', 'REDE-SOCIAL', GITHUB));
    expect(await applyOp(op, sim.port)).toMatchObject({ status: 'conferido' });
    const saved = getAttr(byName(sim.state.root, 'ENDERECO'), 'REDE-SOCIAL') ?? '';
    expect(saved).toMatch(/Linkedin/);
    expect(saved).toMatch(/GitHub, Endereço: https:\/\/github.com\/exemplo/);
  });

  it('o Lattes com outras redes: nada vai', async () => {
    const sim = await lattes();
    setAttr(byName(sim.state.root, 'ENDERECO'), 'REDE-SOCIAL', '');
    const op = onlyOp(set('ENDERECO', 'REDE-SOCIAL', GITHUB));
    expect(await applyOp(op, sim.port)).toMatchObject({ status: 'divergente' });
    expect(postsOf(sim)).toEqual([]);
  });
});
