// Alterar no lugar as produções bibliográficas pelo motor de produção
// (src/bridge/production/targets/bibliografica*.ts): a especificação de cada
// tipo conferida contra o censo, e o envio de campos, autores e palavras-chave
// no Lattes simulado, com a divergência que não envia nada.

import { readFileSync } from 'node:fs';

import { afterEach, describe, expect, it } from 'vitest';

import { applyOp } from '../src/bridge/apply.ts';
import { planChanges } from '../src/bridge/plan.ts';
import type { ProductionOp } from '../src/bridge/production/plan.ts';
import { mediaAmong } from '../src/bridge/production/targets/bibliografica-comum.ts';
import { PRODUCTION_TARGETS } from '../src/bridge/production/targets/index.ts';
import type { FieldMap } from '../src/bridge/production/types.ts';
import { diffDocuments } from '../src/model/changes.ts';
import { encodeLatin1 } from '../src/model/latin1.ts';
import { readKeywords, setKeywords } from '../src/model/production.ts';
import {
  childElements,
  element,
  getAttr,
  parseXml,
  setAttr,
  type XElement,
} from '../src/model/xml.ts';
import { lattesSchema } from '../src/schema/lattes.ts';
import {
  faults,
  findIn,
  type LattesSimuladoNoTeste,
  postsOf,
  withLattesSimulado,
} from './helpers/lattes-simulado.ts';

// O censo -------------------------------------------------------------------------

interface CensusField {
  name: string;
  options?: { label: string; value: string }[] | string;
}
interface CensusForm {
  action: string;
  fields: CensusField[];
  hidden: string[];
  name: string;
}
interface CensusFile {
  entries: { id: string; page?: { forms: CensusForm[] } }[];
  lists: Record<string, { label: string; value: string }[]>;
}

const census = (name: string) =>
  JSON.parse(readFileSync(`docs/lattes-formularios/${name}`, 'utf8')) as CensusFile;
const MAIN = census('censo-2026-10-15.json');
const RECAPTURE = census('censo-2026-10-15b.json');

/** Tipo do motor → entrada do censo (o artigo publicado é da recaptura). */
const CENSUS_ENTRY: Record<string, [CensusFile, string]> = {
  'artigo-aceito': [MAIN, 'artigo-aceito'],
  'artigo-publicado': [RECAPTURE, 'artigo-publicado'],
  livro: [MAIN, 'livro-capitulo'],
  partitura: [MAIN, 'partitura'],
  'texto-jornal': [MAIN, 'texto-jornal'],
  traducao: [MAIN, 'traducao'],
  'trabalho-em-eventos': [MAIN, 'trabalho-em-eventos'],
};

const BIB_IDS = [...Object.keys(CENSUS_ENTRY), 'outra-bibliografica'];
const target = (id: string) => PRODUCTION_TARGETS.find((t) => t.id === id)!;
const mapOf = (m: FieldMap | string): FieldMap => (typeof m === 'string' ? { field: m } : m);

function censusForm(id: string): { file: CensusFile; form: CensusForm } {
  const [file, entryId] = CENSUS_ENTRY[id]!;
  const forms = file.entries.find((e) => e.id === entryId)!.page!.forms;
  return { file, form: forms.find((f) => f.name === target(id).form.name)! };
}

describe('especificação das produções bibliográficas', () => {
  it.each(BIB_IDS)('%s: cada chave é um atributo do schema, numa parte do item', (id) => {
    const t = target(id);
    const parts = lattesSchema.elements[t.element]!.children.map((c) => c.name);
    for (const key of [...Object.keys(t.fields), ...Object.keys(t.manual ?? {})]) {
      const [child, attr] = key.split('@') as [string, string];
      expect(parts, key).toContain(child);
      expect(
        lattesSchema.elements[child]!.attributes.map((a) => a.name),
        key,
      ).toContain(attr);
      expect(t.fields[key] && t.manual?.[key], key).toBeFalsy();
    }
  });

  it.each(Object.keys(CENSUS_ENTRY))('%s: formulário, campos, grades e opções do censo', (id) => {
    const t = target(id);
    const { file, form } = censusForm(id);
    expect(form.action).toBe(t.form.action);
    for (const grid of t.grids) expect(form.hidden).toContain(grid);
    for (const [key, m] of Object.entries(t.fields)) {
      const { field, toForm } = mapOf(m);
      const captured = form.fields.find((f) => f.name === field);
      expect(captured, `${key} → ${field}`).toBeDefined();
      const [child, attr] = key.split('@') as [string, string];
      const choices = lattesSchema.elements[child]!.attributes.find((a) => a.name === attr)!.enum;
      if (!toForm || !choices || !captured!.options) continue;
      const options =
        typeof captured!.options === 'string' ? file.lists[captured!.options]! : captured!.options;
      for (const v of [...choices, 'SIM', 'NAO'].filter((c) => choices.includes(c))) {
        const code = toForm(v);
        if (code)
          expect(
            options.map((o) => o.value),
            `${key}: ${v}`,
          ).toContain(code);
      }
    }
  });

  it('f_meio restrito: o meio que o formulário não oferece fica de fora', () => {
    const meio = mediaAmong(['I', 'D']);
    expect([meio('IMPRESSO'), meio('MEIO_DIGITAL'), meio('FILME'), meio(''), meio('WEB')]).toEqual([
      'I',
      'D',
      undefined,
      '',
      undefined,
    ]);
  });
});

// O currículo de teste ------------------------------------------------------------

const OWNER = `<AUTORES NOME-COMPLETO-DO-AUTOR="Pessoa Sintética" NOME-PARA-CITACAO="SINTÉTICA, P." ORDEM-DE-AUTORIA="1"/>`;
const COAUTHOR = `<AUTORES NOME-COMPLETO-DO-AUTOR="Coautora de Exemplo" NOME-PARA-CITACAO="EXEMPLO, C." ORDEM-DE-AUTORIA="2"/>`;
const KEYWORDS = `<PALAVRAS-CHAVE PALAVRA-CHAVE-1="exemplo" PALAVRA-CHAVE-2="" PALAVRA-CHAVE-3="" PALAVRA-CHAVE-4="" PALAVRA-CHAVE-5="" PALAVRA-CHAVE-6=""/>`;
const COMMON = `PAIS-DE-PUBLICACAO="Brasil" IDIOMA="Português" MEIO-DE-DIVULGACAO="IMPRESSO" FLAG-RELEVANCIA="NAO"`;

const item = (name: string, seq: string, parts: string, coauthor: boolean) =>
  `<${name} SEQUENCIA-PRODUCAO="${seq}">${parts}${OWNER}${coauthor ? COAUTHOR : ''}${KEYWORDS}</${name}>`;

function xmlFor(coauthor: boolean): string {
  const i = (name: string, seq: string, parts: string) => item(name, seq, parts, coauthor);
  return `<CURRICULO-VITAE NUMERO-IDENTIFICADOR="1"><DADOS-GERAIS NOME-COMPLETO="Pessoa Sintética"/>
<PRODUCAO-BIBLIOGRAFICA>
<TRABALHOS-EM-EVENTOS>${i('TRABALHO-EM-EVENTOS', '43', `<DADOS-BASICOS-DO-TRABALHO NATUREZA="COMPLETO" TITULO-DO-TRABALHO="Trabalho de Exemplo" ANO-DO-TRABALHO="2011" PAIS-DO-EVENTO="Brasil" IDIOMA="Português" MEIO-DE-DIVULGACAO="IMPRESSO" FLAG-RELEVANCIA="NAO" FLAG-DIVULGACAO-CIENTIFICA="NAO"/><DETALHAMENTO-DO-TRABALHO CLASSIFICACAO-DO-EVENTO="NACIONAL" NOME-DO-EVENTO="Congresso de Exemplo" CIDADE-DO-EVENTO="Porto Alegre" ANO-DE-REALIZACAO="2011" TITULO-DOS-ANAIS-OU-PROCEEDINGS="Anais" PAGINA-INICIAL="1" PAGINA-FINAL="5"/>`)}</TRABALHOS-EM-EVENTOS>
<ARTIGOS-PUBLICADOS>${i('ARTIGO-PUBLICADO', '41', `<DADOS-BASICOS-DO-ARTIGO NATUREZA="COMPLETO" TITULO-DO-ARTIGO="Artigo de Exemplo" ANO-DO-ARTIGO="2010" ${COMMON} DOI="" FLAG-DIVULGACAO-CIENTIFICA="NAO"/><DETALHAMENTO-DO-ARTIGO TITULO-DO-PERIODICO-OU-REVISTA="Revista de Exemplo" ISSN="12345678" VOLUME="3" FASCICULO="2" PAGINA-INICIAL="10" PAGINA-FINAL="20"/><INFORMACOES-ADICIONAIS DESCRICAO-INFORMACOES-ADICIONAIS="Nota"/>`)}</ARTIGOS-PUBLICADOS>
<LIVROS-E-CAPITULOS><LIVROS-PUBLICADOS-OU-ORGANIZADOS>${i('LIVRO-PUBLICADO-OU-ORGANIZADO', '44', `<DADOS-BASICOS-DO-LIVRO TIPO="LIVRO_PUBLICADO" NATUREZA="TEXTO_INTEGRAL" TITULO-DO-LIVRO="Livro de Exemplo" ANO="2012" ${COMMON} FLAG-DIVULGACAO-CIENTIFICA="NAO"/><DETALHAMENTO-DO-LIVRO NUMERO-DE-PAGINAS="200" ISBN="9788500000000" NOME-DA-EDITORA="Editora Exemplo" CIDADE-DA-EDITORA="São Paulo"/>`)}</LIVROS-PUBLICADOS-OU-ORGANIZADOS>
<CAPITULOS-DE-LIVROS-PUBLICADOS>${i('CAPITULO-DE-LIVRO-PUBLICADO', '49', `<DADOS-BASICOS-DO-CAPITULO TITULO-DO-CAPITULO-DO-LIVRO="Capítulo de Exemplo" ANO="2012"/>`)}</CAPITULOS-DE-LIVROS-PUBLICADOS></LIVROS-E-CAPITULOS>
<TEXTOS-EM-JORNAIS-OU-REVISTAS>${i('TEXTO-EM-JORNAL-OU-REVISTA', '45', `<DADOS-BASICOS-DO-TEXTO NATUREZA="JORNAL_DE_NOTICIAS" TITULO-DO-TEXTO="Texto de Exemplo" ANO-DO-TEXTO="2013" ${COMMON} FLAG-DIVULGACAO-CIENTIFICA="NAO"/><DETALHAMENTO-DO-TEXTO TITULO-DO-JORNAL-OU-REVISTA="Jornal Exemplo" FORMATO-DATA-DE-PUBLICACAO="DDMMAAAA" DATA-DE-PUBLICACAO="15032013" LOCAL-DE-PUBLICACAO="Porto Alegre"/>`)}</TEXTOS-EM-JORNAIS-OU-REVISTAS>
<DEMAIS-TIPOS-DE-PRODUCAO-BIBLIOGRAFICA>
${i('OUTRA-PRODUCAO-BIBLIOGRAFICA', '48', `<DADOS-BASICOS-DE-OUTRA-PRODUCAO NATUREZA="Ensaio" TITULO="Outra de Exemplo" ANO="2016" ${COMMON}/><DETALHAMENTO-DE-OUTRA-PRODUCAO EDITORA="Editora Exemplo"/>`)}
${i('PARTITURA-MUSICAL', '47', `<DADOS-BASICOS-DA-PARTITURA NATUREZA="CORAL" TITULO="Partitura de Exemplo" ANO="2015" ${COMMON}/><DETALHAMENTO-DA-PARTITURA FORMACAO-INSTRUMENTAL="Coro misto" EDITORA="Editora Exemplo" NUMERO-DO-CATALOGO="12"/>`)}
${i('PREFACIO-POSFACIO', '50', `<DADOS-BASICOS-DO-PREFACIO-POSFACIO TIPO="PREFACIO" TITULO="Prefácio de Exemplo" ANO="2017"/>`)}
${i('TRADUCAO', '46', `<DADOS-BASICOS-DA-TRADUCAO NATUREZA="LIVRO" TITULO="Tradução de Exemplo" ANO="2014" ${COMMON}/><DETALHAMENTO-DA-TRADUCAO NOME-DO-AUTOR-TRADUZIDO="Autor Original" TITULO-DA-OBRA-ORIGINAL="Original" IDIOMA-DA-OBRA-ORIGINAL="Inglês" EDITORA-DA-TRADUCAO="Editora Exemplo"/>`)}
</DEMAIS-TIPOS-DE-PRODUCAO-BIBLIOGRAFICA>
<ARTIGOS-ACEITOS-PARA-PUBLICACAO>${i('ARTIGO-ACEITO-PARA-PUBLICACAO', '42', `<DADOS-BASICOS-DO-ARTIGO NATUREZA="COMPLETO" TITULO-DO-ARTIGO="Artigo Aceito de Exemplo" ANO-DO-ARTIGO="2026" IDIOMA="Português" FLAG-RELEVANCIA="NAO" FLAG-DIVULGACAO-CIENTIFICA="NAO"/><DETALHAMENTO-DO-ARTIGO TITULO-DO-PERIODICO-OU-REVISTA="Revista Futura" ISSN="87654321"/>`)}</ARTIGOS-ACEITOS-PARA-PUBLICACAO>
</PRODUCAO-BIBLIOGRAFICA></CURRICULO-VITAE>`;
}

const bySeq = (root: XElement, seq: string) =>
  findIn(root, (el) => getAttr(el, 'SEQUENCIA-PRODUCAO') === seq)!;
const partOf = (root: XElement, seq: string, child: string) =>
  childElements(bySeq(root, seq), child)[0]!;

function planAfter(edit: (root: XElement) => void, coauthor = false) {
  const original = parseXml(xmlFor(coauthor)).root;
  const working = parseXml(xmlFor(coauthor)).root;
  edit(working);
  return planChanges(
    diffDocuments(original, working).map((change) => ({ change, itemTitle: 'Item' })),
    working,
    { editProduction: true },
  );
}

function opsAfter(edit: (root: XElement) => void, coauthor = false): ProductionOp[] {
  const plan = planAfter(edit, coauthor);
  expect(plan.unsupported).toEqual([]);
  return plan.ops as ProductionOp[];
}

let open: LattesSimuladoNoTeste | undefined;
afterEach(async () => {
  await open?.close();
  open = undefined;
});

async function lattesFor(coauthor = false, options: Parameters<typeof withLattesSimulado>[0] = {}) {
  await open?.close();
  open = await withLattesSimulado({
    xml: encodeLatin1(`<?xml version="1.0" encoding="ISO-8859-1"?>\n${xmlFor(coauthor)}`),
    ...options,
  });
  return open;
}

// Os tipos, cada um com o que a alteração de campos troca -------------------------

/** [parte, atributo, valor novo, campo do formulário, valor no formulário]. */
type Edit = [string, string, string, string, string];

interface Case {
  edits: Edit[];
  id: string;
  proc: string;
  seq: string;
}

const CASES: Case[] = [
  {
    edits: [
      [
        'DADOS-BASICOS-DO-ARTIGO',
        'TITULO-DO-ARTIGO',
        'Artigo Revisto',
        'f_titulo',
        'Artigo Revisto',
      ],
      ['DADOS-BASICOS-DO-ARTIGO', 'MEIO-DE-DIVULGACAO', 'MEIO_DIGITAL', 'f_meio', 'D'],
      ['DADOS-BASICOS-DO-ARTIGO', 'FLAG-RELEVANCIA', 'SIM', 'F_RELEV', 'S'],
      ['DADOS-BASICOS-DO-ARTIGO', 'IDIOMA', 'Inglês', 'F_IDIOMA', 'EN'],
      ['DETALHAMENTO-DO-ARTIGO', 'VOLUME', '4', 'f_volume', '4'],
      ['DETALHAMENTO-DO-ARTIGO', 'PAGINA-FINAL', '22', 'f_pag_fim', '22'],
      ['INFORMACOES-ADICIONAIS', 'DESCRICAO-INFORMACOES-ADICIONAIS', 'Nova', 'f_ref', 'Nova'],
    ],
    id: 'artigo-publicado',
    proc: 'PKG_ARTIGO.FORM',
    seq: '41',
  },
  {
    edits: [
      ['DADOS-BASICOS-DO-ARTIGO', 'TITULO-DO-ARTIGO-INGLES', 'Accepted', 'f_titulo_en', 'Accepted'],
      [
        'DADOS-BASICOS-DO-ARTIGO',
        'FLAG-DIVULGACAO-CIENTIFICA',
        'SIM',
        'F_STA_DIVULGACAO_CIENTIFICA',
        'S',
      ],
      ['DETALHAMENTO-DO-ARTIGO', 'ISSN', '11112222', 'f_issn', '11112222'],
    ],
    id: 'artigo-aceito',
    proc: 'PKG_ARTIGO_PR.FORM',
    seq: '42',
  },
  {
    edits: [
      ['DADOS-BASICOS-DO-TRABALHO', 'NATUREZA', 'RESUMO', 'F_COD_PROD', '122'],
      ['DADOS-BASICOS-DO-TRABALHO', 'PAIS-DO-EVENTO', 'Portugal', 'f_pais', 'POR'],
      [
        'DETALHAMENTO-DO-TRABALHO',
        'CLASSIFICACAO-DO-EVENTO',
        'INTERNACIONAL',
        'f_tipo_evento',
        'I',
      ],
      [
        'DETALHAMENTO-DO-TRABALHO',
        'NOME-DO-EVENTO',
        'Congresso Revisto',
        'f_evento',
        'Congresso Revisto',
      ],
    ],
    id: 'trabalho-em-eventos',
    proc: 'PKG_TRABALHO.FORM',
    seq: '43',
  },
  {
    edits: [
      ['DADOS-BASICOS-DO-LIVRO', 'TIPO', 'LIVRO_ORGANIZADO_OU_EDICAO', 'F_COD_PROD', '133'],
      [
        'DETALHAMENTO-DO-LIVRO',
        'NOME-DA-EDITORA',
        'Editora Revista',
        'f_editora',
        'Editora Revista',
      ],
      ['DETALHAMENTO-DO-LIVRO', 'NUMERO-DE-VOLUMES', '2', 'f_volume_l', '2'],
    ],
    id: 'livro',
    proc: 'PKG_LVR_CAP.FORM_LVR',
    seq: '44',
  },
  {
    edits: [
      ['DADOS-BASICOS-DO-TEXTO', 'NATUREZA', 'REVISTA_MAGAZINE', 'F_COD_PROD', '142'],
      ['DETALHAMENTO-DO-TEXTO', 'DATA-DE-PUBLICACAO', '16032013', 'f_data', '16/03/2013'],
    ],
    id: 'texto-jornal',
    proc: 'PKG_TEXTO.FORM',
    seq: '45',
  },
  {
    edits: [
      ['DADOS-BASICOS-DA-TRADUCAO', 'NATUREZA', 'ARTIGO', 'F_COD_PROD', '1A1'],
      ['DADOS-BASICOS-DA-TRADUCAO', 'TITULO', 'Tradução Revista', 'f_titulo', 'Tradução Revista'],
      ['DETALHAMENTO-DA-TRADUCAO', 'IDIOMA-DA-OBRA-ORIGINAL', 'Francês', 'F_IDIOMA_OBRA', 'FR'],
    ],
    id: 'traducao',
    proc: 'PRC_BIB_TRADUCAO',
    seq: '46',
  },
  {
    edits: [
      ['DADOS-BASICOS-DA-PARTITURA', 'NATUREZA', 'ORQUESTRA', 'F_COD_PROD', '1B3'],
      ['DETALHAMENTO-DA-PARTITURA', 'NUMERO-DO-CATALOGO', '13', 'f_issn', '13'],
    ],
    id: 'partitura',
    proc: 'PRC_BIB_PARTITURA',
    seq: '47',
  },
  {
    edits: [
      ['DADOS-BASICOS-DE-OUTRA-PRODUCAO', 'TITULO', 'Outra Revista', 'f_titulo', 'Outra Revista'],
      ['DETALHAMENTO-DE-OUTRA-PRODUCAO', 'EDITORA', 'Editora Nova', 'f_editora', 'Editora Nova'],
    ],
    id: 'outra-bibliografica',
    proc: 'PRC_BIB_OUTRAPROD',
    seq: '48',
  },
];

const applyEdits = (c: Case) => (root: XElement) => {
  for (const [child, attr, value] of c.edits) setAttr(partOf(root, c.seq, child), attr, value);
};

const authorNames = (root: XElement, seq: string) =>
  childElements(bySeq(root, seq), 'AUTORES').map((a) => getAttr(a, 'NOME-COMPLETO-DO-AUTOR'));

describe.each(CASES)('$id no Lattes simulado', (c) => {
  it('campos: cada parte num envio, gravado e conferido', async () => {
    const lattes = await lattesFor();
    const ops = opsAfter(applyEdits(c));
    expect(ops.every((op) => op.target === c.id)).toBe(true);
    for (const op of ops) {
      expect(await applyOp(op, lattes.port)).toMatchObject({ status: 'conferido' });
    }
    const posts = postsOf(lattes);
    expect(posts.every((p) => p.proc === c.proc)).toBe(true);
    const sent = Object.assign({}, ...posts.map((p) => p.fields)) as Record<string, string>;
    for (const [child, attr, value, field, formValue] of c.edits) {
      expect(sent[field], field).toBe(formValue);
      expect(getAttr(partOf(lattes.state.root, c.seq, child), attr), attr).toBe(value);
    }
    expect(authorNames(lattes.state.root, c.seq)).toEqual(['Pessoa Sintética']);
  });

  it('palavras-chave: troca a grade e confere', async () => {
    const lattes = await lattesFor();
    const [op] = opsAfter((root) =>
      setKeywords(lattesSchema, bySeq(root, c.seq), ['exemplo', 'revisão']),
    );
    expect(await applyOp(op!, lattes.port)).toMatchObject({ status: 'conferido' });
    expect(postsOf(lattes)[0]!.fields.f_plv_l).toBe('exemplo|1@revisão|-1');
    expect(readKeywords(bySeq(lattes.state.root, c.seq))).toEqual(['exemplo', 'revisão']);
  });

  it('autores: pôr a coautora que está na lista do Lattes', async () => {
    const lattes = await lattesFor();
    const [op] = opsAfter((root) => {
      bySeq(root, c.seq).children.push(
        element('AUTORES', {
          'NOME-COMPLETO-DO-AUTOR': 'Coautora de Exemplo',
          'NOME-PARA-CITACAO': 'EXEMPLO, C.',
          'ORDEM-DE-AUTORIA': '2',
        }),
      );
    });
    expect(await applyOp(op!, lattes.port)).toMatchObject({ status: 'conferido' });
    expect(authorNames(lattes.state.root, c.seq)).toEqual([
      'Pessoa Sintética',
      'Coautora de Exemplo',
    ]);
  });

  it('autores: tirar a coautora', async () => {
    const lattes = await lattesFor(true);
    const [op] = opsAfter((root) => {
      const it = bySeq(root, c.seq);
      it.children = it.children.filter(
        (x) => !(x.kind === 'element' && getAttr(x, 'ORDEM-DE-AUTORIA') === '2'),
      );
    }, true);
    expect(await applyOp(op!, lattes.port)).toMatchObject({ status: 'conferido' });
    expect(authorNames(lattes.state.root, c.seq)).toEqual(['Pessoa Sintética']);
  });

  it('o Lattes com outro valor no campo: nada é enviado', async () => {
    const lattes = await lattesFor();
    const [child, attr, value] = c.edits.at(-1)!;
    setAttr(partOf(lattes.state.root, c.seq, child), attr, `${value} (outro)`);
    const [op] = opsAfter((root) => setAttr(partOf(root, c.seq, child), attr, value));
    expect(await applyOp(op!, lattes.port)).toMatchObject({ status: 'divergente' });
    expect(postsOf(lattes)).toEqual([]);
  });
});

describe('produções bibliográficas: o que fica à mão', () => {
  const reasonOf = (edit: (root: XElement) => void) => {
    const plan = planAfter(edit);
    expect(plan.ops).toEqual([]);
    return plan.unsupported.map((u) => u.reason);
  };

  it('capítulo e prefácio: o formulário não foi lido', () => {
    expect(
      reasonOf((root) => setAttr(partOf(root, '49', 'DADOS-BASICOS-DO-CAPITULO'), 'ANO', '2013')),
    ).toEqual(['Formulário não suportado ainda']);
    expect(
      reasonOf((root) =>
        setAttr(partOf(root, '50', 'DADOS-BASICOS-DO-PREFACIO-POSFACIO'), 'ANO', '2018'),
      ),
    ).toEqual(['Formulário não suportado ainda']);
  });

  it('o DOI, com o motivo', () => {
    const [reason] = reasonOf((root) =>
      setAttr(partOf(root, '41', 'DADOS-BASICOS-DO-ARTIGO'), 'DOI', '10.1000/x'),
    );
    expect(reason).toMatch(/^Fica à mão\. DOI: o campo do DOI no Lattes/);
  });

  it('o que o formulário do artigo aceito não tem', () => {
    expect(
      reasonOf((root) => setAttr(partOf(root, '42', 'DETALHAMENTO-DO-ARTIGO'), 'VOLUME', '2')),
    ).toEqual(['O formulário deste tipo no Lattes não tem: Volume']);
  });

  it('o meio que o formulário do artigo publicado não oferece', () => {
    expect(
      reasonOf((root) =>
        setAttr(partOf(root, '41', 'DADOS-BASICOS-DO-ARTIGO'), 'MEIO-DE-DIVULGACAO', 'FILME'),
      ),
    ).toEqual(['Valor sem correspondência no formulário do Lattes: Meio de divulgação']);
  });

  it('a página sem um campo da especificação: nada é enviado', async () => {
    const lattes = await lattesFor(false, {
      intercept: faults.rewritePages(/prc_bib_outraprod/i, (html) =>
        html.replace(/<input[^>]*name="f_editora"[^>]*>/, ''),
      ),
    });
    const [op] = opsAfter((root) =>
      setAttr(partOf(root, '48', 'DETALHAMENTO-DE-OUTRA-PRODUCAO'), 'EDITORA', 'Editora Nova'),
    );
    expect(await applyOp(op!, lattes.port)).toMatchObject({
      detail: 'O formulário do Lattes não tem o campo de Editora; nada foi enviado',
      status: 'erro',
    });
    expect(postsOf(lattes)).toEqual([]);
  });

  it('o mesmo título num tipo e noutro não se confunde: cada lista tem os seus', async () => {
    const lattes = await lattesFor();
    // O artigo aceito com o título e o ano do publicado: as listas são outras.
    const accepted = partOf(lattes.state.root, '42', 'DADOS-BASICOS-DO-ARTIGO');
    setAttr(accepted, 'TITULO-DO-ARTIGO', 'Artigo de Exemplo');
    setAttr(accepted, 'ANO-DO-ARTIGO', '2010');
    const [op] = opsAfter((root) =>
      setAttr(partOf(root, '41', 'DETALHAMENTO-DO-ARTIGO'), 'VOLUME', '9'),
    );
    expect(await applyOp(op!, lattes.port)).toMatchObject({ status: 'conferido' });
    expect(postsOf(lattes).map((p) => p.proc)).toEqual(['PKG_ARTIGO.FORM']);
  });
});
