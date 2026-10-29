// "Carregar do Lattes" (src/bridge/load/) contra o Lattes simulado: o
// currículo montado só pelas listas e pelos formulários tem, campo a campo, o
// que o simulado guarda, em todo campo que um formulário mostra.

import { readFileSync } from 'node:fs';

import { afterEach, describe, expect, it } from 'vitest';

import { withListValues } from '../scripts/cobertura-exemplo.ts';
import { AP_LEVELS, FORMATION_LEVELS } from '../src/bridge/create-formacao.ts';
import { ENDERECO_FIELDS, ENDERECO_STREET, IDENT_FIELDS } from '../src/bridge/dados-gerais-edit.ts';
import { ACTIVITY_TYPES, PERIOD } from '../src/bridge/edit-atividade.ts';
import { EVENT_BASICS_FIELDS, EVENT_DETAIL_FIELDS } from '../src/bridge/edit-items.ts';
import { COMPL_LEVELS, listEditFields } from '../src/bridge/edit-lists.ts';
import { FORMACAO_FIELDS } from '../src/bridge/formacao-edit.ts';
import { loadCvFromLattes, type LoadPort } from '../src/bridge/load/loader.ts';
import { readPages } from '../src/bridge/load/pages.ts';
import { VINCULO_FIELDS } from '../src/bridge/plan.ts';
import { PRODUCTION_TARGETS } from '../src/bridge/production/targets/index.ts';
import { mapOf, partOf } from '../src/bridge/refresh/from-form.ts';
import { parseSocial } from '../src/model/contacts.ts';
import { encodeCv } from '../src/model/document.ts';
import { foldText } from '../src/model/fold-text.ts';
import { decodeLatin1, encodeLatin1 } from '../src/model/latin1.ts';
import { getAttr, parseXml, serializeXml, setAttr, walk, type XElement } from '../src/model/xml.ts';
import { lattesSchema } from '../src/schema/lattes.ts';
import { isScreenAttr } from '../src/schema/screen-fields.ts';
import { type LattesSimuladoNoTeste, withLattesSimulado } from './helpers/lattes-simulado.ts';

let open: LattesSimuladoNoTeste | undefined;
afterEach(async () => {
  await open?.close();
  open = undefined;
});

const portOf = (sim: LattesSimuladoNoTeste): LoadPort => ({
  menu: async () => sim.port.menuHtml(),
  pages: (paths) =>
    readPages({ get: (p) => sim.port.get(p), post: (p, body) => sim.port.post(p, body) }, paths),
  readForm: sim.port.readForm,
});

const all = (root: XElement, name: string) => {
  const out: XElement[] = [];
  walk(root, (el) => {
    if (el.name === name) out.push(el);
  });
  return out;
};

const norm = (v: string | undefined) => foldText((v ?? '').trim());

/** As diferenças, campo a campo pelas especificações, entre o simulado e o carregado. */
function productionDiffs(state: XElement, loaded: XElement): string[] {
  const diffs: string[] = [];
  for (const t of PRODUCTION_TARGETS) {
    if (t.id === 'projeto' || t.id === 'linha-de-pesquisa') continue;
    const mine = all(loaded, t.element);
    for (const item of all(state, t.element)) {
      const seq = getAttr(item, 'SEQUENCIA-PRODUCAO');
      const title = getAttr(partOf(item, t.title.child) ?? item, t.title.attr);
      const twin =
        mine.find((m) => seq && getAttr(m, 'SEQUENCIA-PRODUCAO') === seq) ??
        mine.find(
          (m) => norm(getAttr(partOf(m, t.title.child) ?? m, t.title.attr)) === norm(title),
        );
      if (!twin) {
        diffs.push(`${t.id} ${seq ?? title}: não carregado`);
        continue;
      }
      // As partes repetidas e as grades: autores, palavras-chave, setores e áreas.
      for (const part of [
        'AUTORES',
        'PARTICIPANTE-BANCA',
        'PARTICIPANTE-DE-EVENTOS-CONGRESSOS',
        'PALAVRAS-CHAVE',
        'SETORES-DE-ATIVIDADE',
        'AREAS-DO-CONHECIMENTO',
      ]) {
        const flat = (el: XElement) =>
          all(el, part)
            .map((p) =>
              [...p.attrs, ...p.children.flatMap((c) => (c.kind === 'element' ? c.attrs : []))]
                .filter((a) => a.value.trim() && !/^(CPF|ORDEM|SEQUENCIA)/.test(a.name))
                .map((a) => `${a.name}=${norm(a.value)}`)
                .sort()
                .join(' '),
            )
            .join(' | ');
        if (flat(item) !== flat(twin)) {
          diffs.push(`${t.id} ${seq ?? title} ${part}: ${flat(item)} ≠ ${flat(twin)}`);
        }
      }
      for (const [key, m] of Object.entries(t.fields)) {
        if (mapOf(m).field.includes(':')) continue;
        const [child, attr] = key.split('@') as [string, string];
        const want = getAttr(partOf(item, child) ?? item, attr);
        const got = getAttr(partOf(twin, child) ?? twin, attr);
        if (norm(want) !== norm(got))
          diffs.push(`${t.id} ${seq ?? title} ${key}: ${want} ≠ ${got}`);
      }
    }
  }
  return diffs;
}

/**
 * Setores e áreas que o simulado conhece (setorDP e areaDP do menu): o texto
 * genérico do exemplo não está nas listas, e a página o mostraria vazio.
 */
function realistic(xml: string): string {
  const doc = parseXml(xml);
  for (const t of PRODUCTION_TARGETS) {
    for (const item of all(doc.root, t.element)) {
      // O formulário tem um título só: o do registro é o do item.
      const reg = partOf(item, 'REGISTRO-OU-PATENTE');
      const title = getAttr(partOf(item, t.title.child) ?? item, t.title.attr);
      if (reg && title !== undefined) setAttr(reg, 'TITULO-PATENTE', title);
    }
  }
  // Os códigos das buscas são números (o Lattes põe a letra da busca na página).
  walk(doc.root, (el) => {
    for (const a of el.attrs) {
      if (/^CODIGO-(INSTITUICAO|CURSO$|AGENCIA)/.test(a.name) && a.value) a.value = '000100000993';
    }
  });
  // O NIVEL da formação é o f_nivel oculto do formulário (formacao.ts).
  for (const [name, code] of Object.entries({ ...FORMATION_LEVELS, ...AP_LEVELS })) {
    for (const el of all(doc.root, name)) setAttr(el, 'NIVEL', code);
  }
  const compl = all(doc.root, 'FORMACAO-COMPLEMENTAR')[0];
  for (const el of compl?.children ?? []) {
    if (el.kind === 'element') setAttr(el, 'NIVEL', COMPL_LEVELS[el.name] ?? '');
  }
  // O tipo de vínculo é o texto de f_vinc: com outro vínculo informado, LIVRE
  // (como a exportação real, 28/10/2026).
  for (const v of all(doc.root, 'VINCULOS')) {
    if (getAttr(v, 'OUTRO-VINCULO-INFORMADO')) setAttr(v, 'TIPO-DE-VINCULO', 'LIVRE');
  }
  // CONSULTORIA não é opção do formulário de trabalho técnico (lista L41).
  for (const b of all(doc.root, 'DADOS-BASICOS-DO-TRABALHO-TECNICO')) {
    if (getAttr(b, 'NATUREZA') === 'CONSULTORIA') setAttr(b, 'NATUREZA', 'PARECER');
  }
  return (
    serializeXml(doc)
      .replace(/SETOR-DE-ATIVIDADE-1="[^"]*"/g, 'SETOR-DE-ATIVIDADE-1="Alimentação"')
      .replace(/SETOR-DE-ATIVIDADE-2="[^"]*"/g, 'SETOR-DE-ATIVIDADE-2="Alojamento"')
      .replace(/SETOR-DE-ATIVIDADE-3="[^"]*"/g, 'SETOR-DE-ATIVIDADE-3=""')
      .replace(
        /NOME-GRANDE-AREA-DO-CONHECIMENTO="[^"]*"/g,
        'NOME-GRANDE-AREA-DO-CONHECIMENTO="CIENCIAS_BIOLOGICAS"',
      )
      .replace(/NOME-DA-AREA-DO-CONHECIMENTO="[^"]*"/g, 'NOME-DA-AREA-DO-CONHECIMENTO="Genética"')
      .replace(
        /NOME-DA-SUB-AREA-DO-CONHECIMENTO="[^"]*"/g,
        'NOME-DA-SUB-AREA-DO-CONHECIMENTO="Genética Vegetal"',
      )
      .replace(/NOME-DA-ESPECIALIDADE="[^"]*"/g, 'NOME-DA-ESPECIALIDADE=""')
      // O formulário não tem a opção WEB (mappers.ts): a página mostraria "não informado".
      .replace(/MEIO-DE-DIVULGACAO="WEB"/g, 'MEIO-DE-DIVULGACAO="IMPRESSO"')
      // O simulado guarda a cor ou raça pelo nome da opção em maiúsculas (identificacao.ts).
      .replace(/RACA-OU-COR="Branca"/g, 'RACA-OU-COR="BRANCA"')
      // O idioma é um código da lista do formulário (F_COD_IDIOMA).
      .replace(/ IDIOMA="Valor de teste \(idioma\)"/g, ' IDIOMA="EN"')
      .replace(/DESCRICAO-DO-IDIOMA="[^"]*"/g, 'DESCRICAO-DO-IDIOMA="Inglês"')
  );
}

/** Os atributos de DADOS-GERAIS e das partes de um texto só que as páginas mostram. */
function generalDiffs(state: XElement, loaded: XElement): string[] {
  const diffs: string[] = [];
  const general = (root: XElement) => all(root, 'DADOS-GERAIS')[0];
  const attrs = [
    // Os campos só de tela têm teste próprio: o simulado os guarda fora do XML.
    ...Object.keys(IDENT_FIELDS).filter((a) => !isScreenAttr(a)),
    'NOME-EM-CITACOES-BIBLIOGRAFICAS',
    'NACIONALIDADE',
    'SIGLA-PAIS-NACIONALIDADE',
    'PAIS-DE-NACIONALIDADE',
    'CPF',
    'NOME-DO-PAI',
    'NOME-DA-MAE',
  ];
  const parts: [string, string[]][] = [
    ['DADOS-GERAIS', attrs],
    ['RESUMO-CV', ['TEXTO-RESUMO-CV-RH', 'TEXTO-RESUMO-CV-RH-EN']],
    ['OUTRAS-INFORMACOES-RELEVANTES', ['OUTRAS-INFORMACOES-RELEVANTES']],
  ];
  for (const [name, list] of parts) {
    const want = name === 'DADOS-GERAIS' ? general(state) : all(state, name)[0];
    const got = name === 'DADOS-GERAIS' ? general(loaded) : all(loaded, name)[0];
    for (const attr of list) {
      const a = want ? getAttr(want, attr) : undefined;
      const b = got ? getAttr(got, attr) : undefined;
      if (norm(a) !== norm(b)) diffs.push(`${name}@${attr}: ${a} ≠ ${b}`);
    }
  }
  return diffs;
}

/** O endereço: os dois blocos, a correspondência e os contatos (pelo que a tela mostra). */
function addressDiffs(state: XElement, loaded: XElement): string[] {
  const diffs: string[] = [];
  const first = (root: XElement, name: string) => all(root, name)[0];
  for (const name of ['ENDERECO-PROFISSIONAL', 'ENDERECO-RESIDENCIAL']) {
    const attrs = [
      ...Object.keys(ENDERECO_FIELDS),
      ENDERECO_STREET[name]!,
      ...(name === 'ENDERECO-PROFISSIONAL'
        ? ['NOME-INSTITUICAO-EMPRESA', 'CODIGO-INSTITUICAO-EMPRESA', 'NOME-ORGAO']
        : []),
    ];
    for (const attr of attrs) {
      const a = getAttr(first(state, name) ?? first(state, 'ENDERECO')!, attr);
      const b = first(loaded, name) && getAttr(first(loaded, name)!, attr);
      if (norm(a) !== norm(b ?? undefined)) diffs.push(`${name}@${attr}: ${a} ≠ ${b}`);
    }
  }
  const want = first(state, 'ENDERECO');
  const got = first(loaded, 'ENDERECO');
  const shown = (el: XElement | undefined, attr: string) => {
    const v = (el && getAttr(el, attr)) ?? '';
    return JSON.stringify(parseSocial(v));
  };
  // ELETRONICO sai dos dois E-MAIL, conferidos acima (endereco.ts).
  for (const attr of ['REDE-SOCIAL', 'OUTRA-FORMA-DE-CONTATO']) {
    if (shown(want, attr) !== shown(got, attr)) {
      diffs.push(`ENDERECO@${attr}: ${shown(want, attr)} ≠ ${shown(got, attr)}`);
    }
  }
  const pref = (el: XElement | undefined) => (el && getAttr(el, 'FLAG-DE-PREFERENCIA')) ?? '';
  if (pref(want) !== pref(got))
    diffs.push(`ENDERECO@FLAG-DE-PREFERENCIA: ${pref(want)} ≠ ${pref(got)}`);
  return diffs;
}

/** Itens sem número de produção, comparados pelos atributos que a página mostra, na ordem. */
function itemDiffs(state: XElement, loaded: XElement, name: string, attrs: string[]): string[] {
  const flat = (root: XElement) =>
    all(root, name).map((el) => attrs.map((a) => `${a}=${norm(getAttr(el, a))}`).join(' '));
  const want = flat(state);
  const got = flat(loaded);
  return want.length === got.length && want.every((w, i) => w === got[i])
    ? []
    : [`${name}: ${want.join(' | ')} ≠ ${got.join(' | ')}`];
}

const LOOKUP_ATTRS = [
  'CODIGO-INSTITUICAO',
  'NOME-INSTITUICAO',
  'CODIGO-CURSO',
  'NOME-CURSO',
  'CODIGO-AGENCIA-FINANCIADORA',
  'NOME-AGENCIA',
  'CODIGO-INSTITUICAO-DOUT',
  'NOME-INSTITUICAO-DOUT',
  'CODIGO-INSTITUICAO-GRAD',
  'NOME-INSTITUICAO-GRAD',
];

/** A formação, pelo número dela, nos atributos da tabela do conector e nas grades. */
function formationDiffs(
  state: XElement,
  loaded: XElement,
  container = 'FORMACAO-ACADEMICA-TITULACAO',
  table: Record<string, unknown> = FORMACAO_FIELDS,
): string[] {
  const diffs: string[] = [];
  const box = (root: XElement) => all(root, container)[0];
  const items = (root: XElement) =>
    box(root)?.children.filter((c): c is XElement => c.kind === 'element') ?? [];
  for (const item of items(state)) {
    const seq = getAttr(item, 'SEQUENCIA-FORMACAO');
    const twin = items(loaded).find((m) => getAttr(m, 'SEQUENCIA-FORMACAO') === seq);
    if (!twin || twin.name !== item.name) {
      diffs.push(`${item.name} ${seq}: não carregado`);
      continue;
    }
    const own = lattesSchema.elements[item.name]!.attributes.map((a) => a.name);
    for (const attr of [...Object.keys(table), ...LOOKUP_ATTRS, 'NIVEL']) {
      if (!own.includes(attr)) continue;
      const a = getAttr(item, attr);
      const b = getAttr(twin, attr);
      if (norm(a) !== norm(b)) diffs.push(`${item.name} ${seq} ${attr}: ${a} ≠ ${b}`);
    }
    for (const part of ['PALAVRAS-CHAVE', 'SETORES-DE-ATIVIDADE', 'AREAS-DO-CONHECIMENTO']) {
      const flat = (el: XElement) =>
        all(el, part)
          .flatMap((p) => [p, ...p.children.filter((c): c is XElement => c.kind === 'element')])
          .flatMap((p) =>
            p.attrs.filter((x) => x.value.trim()).map((x) => `${x.name}=${norm(x.value)}`),
          )
          .sort()
          .join(' ');
      if (flat(item) !== flat(twin))
        diffs.push(`${item.name} ${seq} ${part}: ${flat(item)} ≠ ${flat(twin)}`);
    }
  }
  return diffs;
}

/** Os eventos, pelo número, nos atributos das tabelas do conector, na natureza e na forma. */
function eventDiffs(state: XElement, loaded: XElement): string[] {
  const diffs: string[] = [];
  const items = (root: XElement) =>
    all(root, 'PARTICIPACAO-EM-EVENTOS-CONGRESSOS')[0]?.children.filter(
      (c): c is XElement => c.kind === 'element',
    ) ?? [];
  const attrs = [
    ...Object.keys(EVENT_BASICS_FIELDS).filter((a) => !isScreenAttr(a)),
    ...Object.keys(EVENT_DETAIL_FIELDS),
    'NATUREZA',
    'FORMA-PARTICIPACAO',
  ];
  for (const item of items(state)) {
    const seq = getAttr(item, 'SEQUENCIA-PRODUCAO');
    const twin = items(loaded).find((m) => getAttr(m, 'SEQUENCIA-PRODUCAO') === seq);
    if (!twin || twin.name !== item.name) {
      diffs.push(`${item.name} ${seq}: não carregado`);
      continue;
    }
    const parts = (el: XElement) => el.children.filter((c): c is XElement => c.kind === 'element');
    for (const attr of attrs) {
      const find = (el: XElement) =>
        parts(el)
          .map((p) => getAttr(p, attr))
          .find((x) => x !== undefined);
      if (norm(find(item)) !== norm(find(twin))) {
        diffs.push(`${item.name} ${seq} ${attr}: ${find(item)} ≠ ${find(twin)}`);
      }
    }
  }
  return diffs;
}

/**
 * A atuação inteira, elemento a elemento na ordem do documento: o nome e os
 * atributos que as páginas mostram (os sem formulário ficam de fora).
 */
function atuacaoDiffs(state: XElement, loaded: XElement): string[] {
  const shown = new Set(
    [
      'CODIGO-INSTITUICAO',
      'NOME-INSTITUICAO',
      'SEQUENCIA-ATIVIDADE',
      'SEQUENCIA-HISTORICO',
      'SEQUENCIA-FUNCAO-ATIVIDADE',
      'SEQUENCIA-LINHA',
      'SEQUENCIA-PROJETO',
      'SEQUENCIA-ESPECIFICACAO',
      ...Object.keys(VINCULO_FIELDS).filter((a) => !isScreenAttr(a)),
      'TIPO-DE-VINCULO',
      'OUTRO-VINCULO-INFORMADO',
      ...Object.keys(PERIOD).filter((a) => !isScreenAttr(a)),
      'TIPO-ENSINO',
      'NOME-CURSO',
      'CODIGO-CURSO',
      'NOME-ORGAO',
      'NOME-UNIDADE',
      ...Object.values(ACTIVITY_TYPES).flatMap((t) => (t.description ? [t.description] : [])),
      ...Object.keys(PRODUCTION_TARGETS.find((t) => t.id === 'linha-de-pesquisa')!.fields),
      ...Object.keys(PRODUCTION_TARGETS.find((t) => t.id === 'projeto')!.fields),
      'NOME-COMPLETO',
      'NOME-PARA-CITACAO',
      'FLAG-RESPONSAVEL',
      'SEQUENCIA-FINANCIADOR',
      'NATUREZA',
      'SEQUENCIA-PRODUCAO-CT',
      'TITULO-DA-PRODUCAO-CT',
      'TIPO-PRODUCAO-CT',
    ].map((k) => k.split('@').pop()!),
  );
  // O que a página não mostra: o órgão do ensino e o de quem tem unidade (só
  // "/Unidade" aparece), o período da participação em projeto e as
  // orientações fora de PRODUCOES-CT-DO-PROJETO.
  const hidden = (el: XElement, attr: string) =>
    (attr === 'NOME-ORGAO' && (el.name === 'ENSINO' || Boolean(getAttr(el, 'NOME-UNIDADE')))) ||
    (el.name === 'PARTICIPACAO-EM-PROJETO' && /^(MES|ANO)-|FLAG-PERIODO/.test(attr));
  const skipped = new Set(['ORIENTACOES', 'ORIENTACAO']);
  const flat = (root: XElement) => {
    const out: string[] = [];
    const box = all(root, 'ATUACOES-PROFISSIONAIS')[0];
    if (box) {
      walk(box, (el) => {
        if (skipped.has(el.name)) return;
        const attrs = el.attrs
          .filter((a) => shown.has(a.name) && a.value.trim() && !hidden(el, a.name))
          .map((a) => `${a.name}=${norm(a.value)}`)
          .sort();
        // Texto só nas disciplinas e nos treinamentos (a grade da atividade).
        const text = ['DISCIPLINA', 'TREINAMENTO'].includes(el.name)
          ? el.children.map((c) => (c.kind === 'text' ? c.value : '')).join('')
          : '';
        out.push(`${el.name} ${attrs.join(' ')}${text.trim() ? ` "${norm(text)}"` : ''}`);
      });
    }
    return out;
  };
  const want = flat(state);
  const got = flat(loaded);
  const diffs: string[] = [];
  for (let i = 0; i < Math.max(want.length, got.length); i++) {
    if (want[i] !== got[i]) diffs.push(`${want[i]} ≠ ${got[i]}`);
  }
  return diffs;
}

describe('Carregar do Lattes pelas listas e pelos formulários', () => {
  it('a atuação profissional vem com vínculos, atividades, linhas e projetos', async () => {
    const full = realistic(
      withListValues(decodeLatin1(readFileSync('fixtures/synthetic_full.xml'))).xml,
    );
    open = await withLattesSimulado({ xml: encodeLatin1(full) });
    const result = await loadCvFromLattes(portOf(open));
    expect(atuacaoDiffs(open.state.root, result.doc!.root)).toEqual([]);
  });

  it('a participação em eventos vem campo a campo', async () => {
    const full = realistic(
      withListValues(decodeLatin1(readFileSync('fixtures/synthetic_full.xml'))).xml,
    );
    open = await withLattesSimulado({ xml: encodeLatin1(full) });
    const result = await loadCvFromLattes(portOf(open));
    expect(eventDiffs(open.state.root, result.doc!.root)).toEqual([]);
  });

  it('a formação acadêmica vem campo a campo', async () => {
    const full = realistic(
      withListValues(decodeLatin1(readFileSync('fixtures/synthetic_full.xml'))).xml,
    );
    open = await withLattesSimulado({ xml: encodeLatin1(full) });
    const result = await loadCvFromLattes(portOf(open));
    expect(formationDiffs(open.state.root, result.doc!.root)).toEqual([]);
  });

  it('a formação complementar vem campo a campo, com o segundo passo', async () => {
    const full = realistic(
      withListValues(decodeLatin1(readFileSync('fixtures/synthetic_full.xml'))).xml,
    );
    open = await withLattesSimulado({ xml: encodeLatin1(full) });
    const result = await loadCvFromLattes(portOf(open));
    expect(
      formationDiffs(
        open.state.root,
        result.doc!.root,
        'FORMACAO-COMPLEMENTAR',
        listEditFields('formacao-complementar'),
      ),
    ).toEqual([]);
  });

  it('idiomas, prêmios e áreas de atuação vêm campo a campo', async () => {
    const full = realistic(
      withListValues(decodeLatin1(readFileSync('fixtures/synthetic_full.xml'))).xml,
    );
    open = await withLattesSimulado({ xml: encodeLatin1(full) });
    const result = await loadCvFromLattes(portOf(open));
    const idioma = lattesSchema.elements.IDIOMA!.attributes.map((a) => a.name);
    const premio = Object.keys(listEditFields('premio')).filter((a) => !isScreenAttr(a));
    expect([
      ...itemDiffs(open.state.root, result.doc!.root, 'IDIOMA', idioma),
      ...itemDiffs(open.state.root, result.doc!.root, 'PREMIO-TITULO', premio),
      ...itemDiffs(
        open.state.root,
        result.doc!.root,
        'AREA-DE-ATUACAO',
        lattesSchema.elements['AREA-DE-ATUACAO']!.attributes.map((a) => a.name),
      ),
    ]).toEqual([]);
  });

  it('o endereço vem campo a campo', async () => {
    const full = realistic(
      withListValues(decodeLatin1(readFileSync('fixtures/synthetic_full.xml'))).xml,
    );
    open = await withLattesSimulado({ xml: encodeLatin1(full) });
    const result = await loadCvFromLattes(portOf(open));
    expect(addressDiffs(open.state.root, result.doc!.root)).toEqual([]);
  });

  it('os dados gerais vêm campo a campo', async () => {
    const full = realistic(
      withListValues(decodeLatin1(readFileSync('fixtures/synthetic_full.xml'))).xml,
    );
    open = await withLattesSimulado({ xml: encodeLatin1(full) });
    const result = await loadCvFromLattes(portOf(open));
    expect(generalDiffs(open.state.root, result.doc!.root)).toEqual([]);
  });

  it('a deficiência com mais de um tipo vem pelos rótulos, por vírgula, na ordem dos códigos', async () => {
    const full = realistic(
      withListValues(decodeLatin1(readFileSync('fixtures/synthetic_full.xml'))).xml,
    );
    open = await withLattesSimulado({ xml: encodeLatin1(full) });
    const general = all(open.state.root, 'DADOS-GERAIS')[0]!;
    setAttr(
      general,
      'PCD',
      'Deficiência Auditiva, Transtorno do Espectro Autista, Deficiência Múltipla, Deficiência Visual',
    );
    const result = await loadCvFromLattes(portOf(open));
    expect(getAttr(all(result.doc!.root, 'DADOS-GERAIS')[0]!, 'PCD')).toBe(
      'Deficiência Auditiva, Transtorno do Espectro Autista, Deficiência Múltipla, Deficiência Visual',
    );
  });

  it('os campos só de tela vêm da página e não saem no XML', async () => {
    const full = realistic(
      withListValues(decodeLatin1(readFileSync('fixtures/synthetic_full.xml'))).xml,
    );
    open = await withLattesSimulado({ xml: encodeLatin1(full) });
    const general = all(open.state.root, 'DADOS-GERAIS')[0]!;
    Object.assign(open.state.formOnly(general), {
      f_dta_val_passaporte: '01/02/2030',
      f_nome_social: 'Ana Social',
      f_nome_social_r: 'S',
      f_priv_cor: '2',
      fpaispassaporte: 'ARG',
    });
    const work = all(open.state.root, 'ENDERECO-PROFISSIONAL')[0]!;
    Object.assign(open.state.formOnly(work), {
      f_ddd_cel: '51',
      f_fone_cel: '999990000',
      f_priv_profissional: '2',
    });
    const result = await loadCvFromLattes(portOf(open));
    const loaded = all(result.doc!.root, 'DADOS-GERAIS')[0]!;
    expect(
      Object.fromEntries(
        loaded.attrs.filter((a) => isScreenAttr(a.name)).map((a) => [a.name, a.value]),
      ),
    ).toEqual({
      'tela:f_dta_emissao_doc': '',
      'tela:f_dta_val_passaporte': '01/02/2030',
      'tela:f_nome_social': 'Ana Social',
      'tela:f_nome_social_r': 'S',
      'tela:f_priv_cor': '2',
      'tela:f_priv_foto': '1',
      'tela:f_priv_identidade': '1',
      'tela:f_priv_nacionalidade': '1',
      'tela:f_priv_nascimento': '1',
      'tela:f_priv_passaporte': '1',
      'tela:f_priv_pcd': '1',
      'tela:fpaispassaporte': 'ARG',
    });
    const loadedWork = all(result.doc!.root, 'ENDERECO-PROFISSIONAL')[0]!;
    expect(getAttr(loadedWork, 'tela:f_fone_cel')).toBe('999990000');
    expect(getAttr(loadedWork, 'tela:f_ddd_cel')).toBe('51');
    expect(getAttr(loadedWork, 'tela:f_priv_profissional')).toBe('2');
    expect(getAttr(loadedWork, 'tela:f_priv_email')).toBe('1');
    // A visibilidade de cada item, pela lista f_tipo_privacidade do formulário dele.
    for (const name of ['ARTIGO-PUBLICADO', 'PREMIO-TITULO', 'IDIOMA', 'DOUTORADO']) {
      const want = all(open.state.root, name)[0]!;
      open.state.privacy.set(want, '2');
    }
    const again = await loadCvFromLattes(portOf(open));
    for (const name of ['ARTIGO-PUBLICADO', 'PREMIO-TITULO', 'IDIOMA', 'DOUTORADO']) {
      const items = all(again.doc!.root, name);
      expect(
        items.map((i) => getAttr(i, 'tela:f_tipo_privacidade')),
        name,
      ).toContain('2');
      expect(
        items.every((i) => getAttr(i, 'tela:f_tipo_privacidade') !== undefined),
        name,
      ).toBe(true);
    }
    // A visibilidade de um vínculo e de uma atividade, na leitura da atuação.
    const bond = all(open.state.root, 'VINCULOS')[0]!;
    const job = all(open.state.root, 'DIRECAO-E-ADMINISTRACAO')[0]!;
    open.state.privacy.set(bond, '2');
    open.state.privacy.set(job, '2');
    const fourth = await loadCvFromLattes(portOf(open));
    for (const name of ['VINCULOS', 'DIRECAO-E-ADMINISTRACAO']) {
      const got = all(fourth.doc!.root, name).map((i) => getAttr(i, 'tela:f_tipo_privacidade'));
      expect(got, name).toContain('2');
    }
    // A classificação do evento, que o simulado guarda ao lado do item.
    const congress = all(open.state.root, 'PARTICIPACAO-EM-CONGRESSO')[0]!;
    open.state.formOnly(congress).f_classif = 'N';
    const third = await loadCvFromLattes(portOf(open));
    const basics = all(third.doc!.root, 'DADOS-BASICOS-DA-PARTICIPACAO-EM-CONGRESSO');
    expect(basics.map((b) => getAttr(b, 'tela:f_classif'))).toContain('N');
    // Nenhum arquivo que sai do editor os leva.
    const bytes = encodeCv(result.doc!, 'ISO-8859-1');
    expect(decodeLatin1(bytes)).not.toContain('tela:');
    expect(getAttr(loaded, 'tela:f_nome_social')).toBe('Ana Social');
  });

  it('as produções do currículo de demonstração vêm campo a campo', async () => {
    open = await withLattesSimulado();
    const result = await loadCvFromLattes(portOf(open));
    expect(result.stopped).toBeUndefined();
    expect(productionDiffs(open.state.root, result.doc!.root)).toEqual([]);
  });

  it('as produções do exemplo completo vêm campo a campo', async () => {
    const full = realistic(
      withListValues(decodeLatin1(readFileSync('fixtures/synthetic_full.xml'))).xml,
    );
    open = await withLattesSimulado({ xml: encodeLatin1(full) });
    const result = await loadCvFromLattes(portOf(open));
    expect(result.stopped).toBeUndefined();
    expect(result.doc).toBeDefined();
    expect(productionDiffs(open.state.root, result.doc!.root)).toEqual([]);
  });
});
