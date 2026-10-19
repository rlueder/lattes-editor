import { afterEach, describe, expect, it } from 'vitest';

import { applyOp } from '../src/bridge/apply.ts';
import { biographicContract } from '../src/bridge/biographic.ts';
import { checkContract, type Contract, LATTES_CONTRACT } from '../src/bridge/contract.ts';
import { opRows } from '../src/bridge/field-labels.ts';
import { type BridgeOp, planChanges } from '../src/bridge/plan.ts';
import { diffDocuments } from '../src/model/changes.ts';
import { encodeLatin1 } from '../src/model/latin1.ts';
import { getAttr, parseXml, setAttr, type XElement } from '../src/model/xml.ts';
import {
  findIn,
  type LattesSimuladoNoTeste,
  postsOf,
  withLattesSimulado,
} from './helpers/lattes-simulado.ts';

const XML = `<CURRICULO-VITAE NUMERO-IDENTIFICADOR="1" SISTEMA-ORIGEM-XML="LATTES_OFFLINE">
<DADOS-GERAIS NOME-COMPLETO="Pessoa de Teste" NOME-EM-CITACOES-BIBLIOGRAFICAS="TESTE, P." NACIONALIDADE="B" CPF="00000000000" NUMERO-DO-PASSAPORTE="" PAIS-DE-NASCIMENTO="Brasil" UF-NASCIMENTO="RS" CIDADE-NASCIMENTO="Pelotas" FORMATO-DATA-DE-NASCIMENTO="DDMMAAAA" DATA-NASCIMENTO="03051986" SEXO="FEMININO" NUMERO-IDENTIDADE="1234" ORGAO-EMISSOR="SSP" UF-ORGAO-EMISSOR="RS" FORMATO-DATA-DE-EMISSAO="DDMMAAAA" DATA-DE-EMISSAO="12082004" NOME-DO-PAI="Pai de Teste" NOME-DA-MAE="Mãe de Teste" PERMISSAO-DE-DIVULGACAO="NAO" ORCID-ID="" SIGLA-PAIS-NACIONALIDADE="BRA" PAIS-DE-NACIONALIDADE="Brasil" RACA-OU-COR="" PCD="">
<OUTRAS-INFORMACOES-RELEVANTES OUTRAS-INFORMACOES-RELEVANTES="Texto antigo"/>
<ENDERECO FLAG-DE-PREFERENCIA="ENDERECO_INSTITUCIONAL" REDE-SOCIAL="" ELETRONICO="" OUTRA-FORMA-DE-CONTATO="">
<ENDERECO-PROFISSIONAL NOME-INSTITUICAO-EMPRESA="Universidade" NOME-ORGAO="" NOME-UNIDADE="" LOGRADOURO-COMPLEMENTO="Rua A, 1" PAIS="Brasil" UF="RS" CEP="90000000" CIDADE="Porto Alegre" BAIRRO="Centro" DDD="51" TELEFONE="33330000" RAMAL="" FAX="" CAIXA-POSTAL="" E-MAIL="" HOME-PAGE=""/>
<ENDERECO-RESIDENCIAL LOGRADOURO="Rua B, 2" PAIS="Brasil" UF="RS" CEP="96000000" CIDADE="Pelotas" BAIRRO="Fragata" DDD="" TELEFONE="" RAMAL="" FAX="" CAIXA-POSTAL="" E-MAIL="" HOME-PAGE=""/>
</ENDERECO>
</DADOS-GERAIS></CURRICULO-VITAE>`;

const byName = (root: XElement, name: string) => findIn(root, (el) => el.name === name)!;

function planned(edit: (root: XElement) => void) {
  const original = parseXml(XML).root;
  const working = parseXml(XML).root;
  edit(working);
  return planChanges(
    diffDocuments(original, working).map((change) => ({ change, itemTitle: '' })),
    working,
    { biographicFull: true, biographicOps: true },
  );
}

function onlyOp(edit: (root: XElement) => void): BridgeOp {
  const plan = planned(edit);
  expect(plan.unsupported).toEqual([]);
  expect(plan.ops).toHaveLength(1);
  return plan.ops[0]!;
}

const reasonOf = (edit: (root: XElement) => void) => planned(edit).unsupported[0]?.reason;

const edit =
  (name: string, attrs: Record<string, string>) =>
  (root: XElement): void => {
    const el = byName(root, name);
    for (const [k, v] of Object.entries(attrs)) setAttr(el, k, v);
  };

let open: LattesSimuladoNoTeste | undefined;
afterEach(async () => {
  await open?.close();
  open = undefined;
});

async function lattesFor() {
  await open?.close();
  open = await withLattesSimulado({
    xml: encodeLatin1(`<?xml version="1.0" encoding="ISO-8859-1"?>\n${XML}`),
  });
  return open;
}

const inState = (lattes: LattesSimuladoNoTeste, name: string) => byName(lattes.state.root, name);
const posts = (lattes: LattesSimuladoNoTeste) => postsOf(lattes).map((p) => p.proc);

describe('identificação: plano', () => {
  it('nascimento, documentos, sexo e cor ou raça, nos campos do formulário', () => {
    const op = onlyOp(
      edit('DADOS-GERAIS', {
        'CIDADE-NASCIMENTO': 'Rio Grande',
        'DATA-DE-EMISSAO': '01022010',
        'DATA-NASCIMENTO': '04051986',
        'NOME-EM-CITACOES-BIBLIOGRAFICAS': 'TESTE, P.;TESTE, PESSOA',
        'NUMERO-DO-PASSAPORTE': 'AB123',
        'NUMERO-IDENTIDADE': '5678',
        'ORGAO-EMISSOR': 'IGP',
        'PAIS-DE-NASCIMENTO': 'Portugal',
        'RACA-OU-COR': 'PARDA',
        SEXO: 'MASCULINO',
        'UF-NASCIMENTO': '',
        'UF-ORGAO-EMISSOR': 'SC',
      }),
    );
    expect(op).toMatchObject({
      expect: {
        f_dta_nasc: '03/05/1986',
        f_dta_rg: '12/08/2004',
        f_nacionalidade: 'B',
        f_pais_nasc: 'BRA',
        f_sexo: 'F',
        f_uf_nasc: 'RS',
        fnro_id_raca_cor: '',
      },
      kind: 'identificacao',
      set: {
        f_cidade_nasc: 'Rio Grande',
        f_dta_nasc: '04/05/1986',
        f_dta_rg: '01/02/2010',
        f_nome_citacao: 'TESTE, P.;TESTE, PESSOA',
        f_nome_citacao_h: 'TESTE, P.;TESTE, PESSOA',
        f_orgao_rg: 'IGP',
        f_pais_nasc: 'POR',
        f_passaporte: 'AB123',
        f_rg_nro: '5678',
        f_sexo: 'M',
        f_uf_nasc: '',
        f_uf_rg: 'SC',
        fnro_id_raca_cor: '3',
      },
    });
    const rows = Object.fromEntries(opRows(op).map((r) => [r.label, `${r.before} → ${r.after}`]));
    expect(rows).toMatchObject({
      'Cor ou raça': '(vazio) → Parda',
      'País de nascimento': 'Brasil → Portugal',
      Sexo: 'Feminino → Masculino',
    });
  });

  it('o país de nacionalidade leva a nacionalidade junto', () => {
    const op = onlyOp(
      edit('DADOS-GERAIS', {
        NACIONALIDADE: 'E',
        'PAIS-DE-NACIONALIDADE': 'Portugal',
        'SIGLA-PAIS-NACIONALIDADE': 'POR',
      }),
    );
    expect(op).toMatchObject({
      expect: { f_nacionalidade: 'B', f_pais_nacio: 'BRA' },
      set: { f_nacionalidade: 'E', f_pais_nacio: 'POR' },
    });
    expect(onlyOp(edit('DADOS-GERAIS', { 'PAIS-DE-NACIONALIDADE': 'Portugal' })).set).toMatchObject(
      { f_pais_nacio: 'POR' },
    );
    expect(reasonOf(edit('DADOS-GERAIS', { NACIONALIDADE: 'E' }))).toMatch(
      /^A nacionalidade segue o país de nacionalidade/,
    );
    expect(
      reasonOf(edit('DADOS-GERAIS', { NACIONALIDADE: 'X', 'PAIS-DE-NACIONALIDADE': 'Portugal' })),
    ).toBe(
      'A nacionalidade segue o país de nacionalidade no Lattes: B para o Brasil, E para os outros',
    );
    expect(
      reasonOf(
        edit('DADOS-GERAIS', {
          'PAIS-DE-NACIONALIDADE': 'Portugal',
          'SIGLA-PAIS-NACIONALIDADE': 'ARG',
        }),
      ),
    ).toMatch(/não são o mesmo país/);
    expect(reasonOf(edit('DADOS-GERAIS', { 'SIGLA-PAIS-NACIONALIDADE': 'XXX' }))).toBe(
      'País de nacionalidade que o Lattes não tem: XXX',
    );
  });

  it('o que o formulário não tem, ou não deixa alterar, fica à mão com o motivo', () => {
    expect(reasonOf(edit('DADOS-GERAIS', { 'ORCID-ID': 'https://orcid.org/x' }))).toMatch(
      /^O formulário de identificação do Lattes não tem: /,
    );
    expect(reasonOf(edit('DADOS-GERAIS', { 'NOME-DO-PAI': 'Outro' }))).toMatch(
      /não deixa alterar: .*\(o campo é oculto na página\)$/,
    );
    expect(reasonOf(edit('DADOS-GERAIS', { CPF: '1' }))).toMatch(/não deixa alterar/);
    expect(reasonOf(edit('DADOS-GERAIS', { PCD: 'A' }))).toMatch(/^Pessoa com deficiência/);
    expect(reasonOf(edit('DADOS-GERAIS', { 'DATA-NASCIMENTO': '3/5/86' }))).toMatch(
      /^Valor que o formulário de identificação do Lattes não tem: /,
    );
    expect(reasonOf(edit('DADOS-GERAIS', { 'NOME-COMPLETO': ' ' }))).toBe(
      'O Lattes não aceita o nome completo vazio',
    );
    expect(reasonOf(edit('CURRICULO-VITAE', { 'SISTEMA-ORIGEM-XML': 'OUTRO' }))).toMatch(
      /^Dados que o próprio Lattes gera na exportação/,
    );
  });
});

describe('endereço e outras informações: plano', () => {
  it('país dos dois endereços e a preferência de correspondência', () => {
    expect(onlyOp(edit('ENDERECO-PROFISSIONAL', { PAIS: 'Argentina' }))).toMatchObject({
      expect: { f_pais_i: 'BRA' },
      kind: 'endereco',
      set: { f_pais_i: 'ARG' },
    });
    const pref = onlyOp(edit('ENDERECO', { 'FLAG-DE-PREFERENCIA': 'ENDERECO_RESIDENCIAL' }));
    expect(opRows(pref)).toEqual([
      expect.objectContaining({
        after: 'Residencial',
        before: 'Profissional',
        label: 'Endereço para correspondência',
      }),
    ]);
    expect(reasonOf(edit('ENDERECO', { 'REDE-SOCIAL': 'x' }))).toMatch(
      /não está no formato do Lattes/,
    );
    expect(reasonOf(edit('ENDERECO-PROFISSIONAL', { 'NOME-UNIDADE': 'Depto' }))).toBe(
      'O formulário de endereço do Lattes não tem campo próprio para: Unidade',
    );
    expect(reasonOf(edit('ENDERECO-RESIDENCIAL', { PAIS: 'Atlântida' }))).toMatch(
      /^Valor que o formulário de endereço do Lattes não tem: /,
    );
  });

  it('outras informações relevantes no formulário próprio', () => {
    const op = onlyOp(
      edit('OUTRAS-INFORMACOES-RELEVANTES', { 'OUTRAS-INFORMACOES-RELEVANTES': 'Texto novo' }),
    );
    expect(op).toMatchObject({
      expect: { F_TEXTO: 'Texto antigo' },
      kind: 'outras-informacoes',
      set: { F_TEXTO: 'Texto novo' },
    });
    expect(opRows(op)[0]).toMatchObject({ label: 'Outras informações relevantes' });
  });
});

describe('identificação, endereço e outras informações no Lattes simulado', () => {
  it('identificação: grava nascimento, documentos e citações, e confere', async () => {
    const lattes = await lattesFor();
    const op = onlyOp(
      edit('DADOS-GERAIS', {
        'DATA-NASCIMENTO': '04051986',
        'NOME-EM-CITACOES-BIBLIOGRAFICAS': 'TESTE, P.;TESTE, PESSOA',
        'NUMERO-DO-PASSAPORTE': 'AB123',
        'PAIS-DE-NASCIMENTO': 'Portugal',
        'RACA-OU-COR': 'PARDA',
        SEXO: 'MASCULINO',
        'UF-ORGAO-EMISSOR': 'SC',
      }),
    );
    expect(await applyOp(op, lattes.port)).toMatchObject({ status: 'conferido' });
    expect(posts(lattes)).toEqual(['PRC_IDENT']);
    const el = inState(lattes, 'DADOS-GERAIS');
    expect(getAttr(el, 'DATA-NASCIMENTO')).toBe('04051986');
    expect(getAttr(el, 'NOME-EM-CITACOES-BIBLIOGRAFICAS')).toBe('TESTE, P.;TESTE, PESSOA');
    expect(getAttr(el, 'PAIS-DE-NASCIMENTO')).toBe('Portugal');
    expect(getAttr(el, 'SEXO')).toBe('MASCULINO');
    expect(getAttr(el, 'RACA-OU-COR')).toBe('PARDA');
    expect(getAttr(el, 'UF-ORGAO-EMISSOR')).toBe('SC');
    expect(getAttr(el, 'NUMERO-DO-PASSAPORTE')).toBe('AB123');
    // O que não estava na operação ficou como estava.
    expect(getAttr(el, 'CPF')).toBe('00000000000');
    expect(getAttr(el, 'NOME-DA-MAE')).toBe('Mãe de Teste');
    expect(getAttr(el, 'NACIONALIDADE')).toBe('B');
  });

  it('identificação: país de nacionalidade troca também a nacionalidade', async () => {
    const lattes = await lattesFor();
    const op = onlyOp(
      edit('DADOS-GERAIS', { NACIONALIDADE: 'E', 'SIGLA-PAIS-NACIONALIDADE': 'POR' }),
    );
    expect(await applyOp(op, lattes.port)).toMatchObject({ status: 'conferido' });
    const el = inState(lattes, 'DADOS-GERAIS');
    expect(getAttr(el, 'NACIONALIDADE')).toBe('E');
    expect(getAttr(el, 'SIGLA-PAIS-NACIONALIDADE')).toBe('POR');
    expect(getAttr(el, 'PAIS-DE-NACIONALIDADE')).toBe('Portugal');
  });

  it('identificação: data de antes diferente no Lattes para sem enviar', async () => {
    const lattes = await lattesFor();
    setAttr(inState(lattes, 'DADOS-GERAIS'), 'DATA-NASCIMENTO', '01011980');
    const op = onlyOp(edit('DADOS-GERAIS', { 'DATA-NASCIMENTO': '04051986' }));
    expect(await applyOp(op, lattes.port)).toMatchObject({
      detail: 'O Lattes não está como o editor espera: Data de nascimento',
      status: 'divergente',
    });
    expect(posts(lattes)).toEqual([]);
  });

  it('endereço: país e correspondência gravados', async () => {
    const lattes = await lattesFor();
    const pais = onlyOp(edit('ENDERECO-RESIDENCIAL', { PAIS: 'Portugal' }));
    expect(await applyOp(pais, lattes.port)).toMatchObject({ status: 'conferido' });
    expect(getAttr(inState(lattes, 'ENDERECO-RESIDENCIAL'), 'PAIS')).toBe('Portugal');
    expect(getAttr(inState(lattes, 'ENDERECO-PROFISSIONAL'), 'PAIS')).toBe('Brasil');
    const pref = onlyOp(edit('ENDERECO', { 'FLAG-DE-PREFERENCIA': 'ENDERECO_RESIDENCIAL' }));
    expect(await applyOp(pref, lattes.port)).toMatchObject({ status: 'conferido' });
    expect(getAttr(inState(lattes, 'ENDERECO'), 'FLAG-DE-PREFERENCIA')).toBe(
      'ENDERECO_RESIDENCIAL',
    );
  });

  it('outras informações: grava, e com outro texto no Lattes para sem enviar', async () => {
    const lattes = await lattesFor();
    const op = onlyOp(
      edit('OUTRAS-INFORMACOES-RELEVANTES', { 'OUTRAS-INFORMACOES-RELEVANTES': 'Texto novo' }),
    );
    expect(await applyOp(op, lattes.port)).toMatchObject({ status: 'conferido' });
    expect(posts(lattes)).toEqual(['PRC_OUTRAS_INF']);
    expect(
      getAttr(inState(lattes, 'OUTRAS-INFORMACOES-RELEVANTES'), 'OUTRAS-INFORMACOES-RELEVANTES'),
    ).toBe('Texto novo');
    const other = await lattesFor();
    setAttr(
      inState(other, 'OUTRAS-INFORMACOES-RELEVANTES'),
      'OUTRAS-INFORMACOES-RELEVANTES',
      'Outro',
    );
    expect(await applyOp(op, other.port)).toMatchObject({ status: 'divergente' });
    expect(posts(other)).toEqual([]);
    const noMenu = { ...other.port, menuHtml: () => '<p>menu</p>' };
    expect(await applyOp(op, noMenu)).toMatchObject({
      detail: 'Formulário de outras informações relevantes não encontrado no menu do Lattes',
      status: 'erro',
    });
  });

  it('o contrato confere o formulário de outras informações só lendo', async () => {
    const lattes = await lattesFor();
    const extra = biographicContract(true);
    const contract: Contract = {
      forms: { ...LATTES_CONTRACT.forms, ...extra.forms },
      menu: [...LATTES_CONTRACT.menu, ...extra.menu],
    };
    const report = await checkContract(lattes.port, contract);
    expect(report.forms.find((f) => f.kind === 'outras-informacoes')).toMatchObject({
      drifts: [],
      status: 'ok',
    });
    expect(report.menu.find((m) => m.proc === 'prc_outras_inf')).toMatchObject({ found: true });
    expect(posts(lattes)).toEqual([]);
  });
});
