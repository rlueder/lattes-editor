// As telas do Lattes simulado que o conector ainda não usa: prêmios, formação
// complementar, a exclusão de formação com SETA_ULTIMO_PUBLICO, projetos, a
// busca de órgão e a patente em dois passos. Cada uma é exercida como a página
// faria, por GET e POST no servidor.

import { afterEach, describe, expect, it } from 'vitest';

import { jsCalls } from '../src/bridge/create-shared.ts';
import { findLinks } from '../src/bridge/lattes-html.ts';
import { parseOrgans } from '../src/bridge/lattes-lists.ts';
import { getAttr, walk, type XElement } from '../src/model/xml.ts';
import { readHtmlForm } from './helpers/html-form.ts';
import { type LattesSimuladoNoTeste, withLattesSimulado } from './helpers/lattes-simulado.ts';

let open: LattesSimuladoNoTeste | undefined;
afterEach(async () => {
  await open?.close();
  open = undefined;
});

async function start() {
  open = await withLattesSimulado();
  return open;
}

function all(root: XElement, name: string): XElement[] {
  const out: XElement[] = [];
  walk(root, (el) => {
    if (el.name === name) out.push(el);
  });
  return out;
}

const field = (html: string, form: string, name: string) =>
  readHtmlForm(html, form)?.find((c) => c.name === name);

describe('Lattes simulado: prêmios e títulos', () => {
  it('altera, inclui e exclui pelo formulário GN_PREMIO', async () => {
    const lattes = await start();
    const code = lattes.state.code;
    const list = await lattes.port.get(`pkg_premio.lista?f_cod=${code}`);
    const rows = findLinks(list, 'pkg_premio.form').filter((l) => l.params.f_seq);
    expect(rows).toHaveLength(2);
    const form = await lattes.port.get(rows[0]!.path);
    expect(field(form, 'GN_PREMIO', 'f_titulo')).toMatchObject({ maxLength: 200 });
    expect(field(form, 'GN_PREMIO', 'f_ctr')?.value).toBe('U');
    expect(form).toContain('Você realmente deseja excluir este Prêmio/Titulo?');

    const seq = rows[0]!.params.f_seq!;
    await lattes.port.post(
      'pkg_premio.form',
      `f_ctr=U&f_cod=${code}&f_seq=${seq}&f_titulo=Bolsa+PQ&f_agencia=CNPq&f_ano=2023&f_tipo_privacidade=1`,
    );
    expect(getAttr(all(lattes.state.root, 'PREMIO-TITULO')[0]!, 'ANO-DA-PREMIACAO')).toBe('2023');
    await lattes.port.post(
      'pkg_premio.form',
      `f_ctr=I&f_cod=${code}&f_seq=&f_titulo=Novo&f_agencia=X&f_ano=2025`,
    );
    expect(all(lattes.state.root, 'PREMIO-TITULO')).toHaveLength(3);
    await lattes.port.post('pkg_premio.form', `f_ctr=E&f_cod=${code}&f_seq=${seq}`);
    expect(all(lattes.state.root, 'PREMIO-TITULO')).toHaveLength(2);
    expect(lattes.state.pending).toBe(true);
  });
});

describe('Lattes simulado: formações e a visibilidade', () => {
  it('a exclusão pergunta a SETA_ULTIMO_PUBLICO quando não há outra formação pública', async () => {
    const lattes = await start();
    const code = lattes.state.code;
    const formacoes = [
      ...all(lattes.state.root, 'GRADUACAO'),
      ...all(lattes.state.root, 'MESTRADO'),
      ...all(lattes.state.root, 'DOUTORADO'),
    ];
    const doutorado = formacoes.at(-1)!;
    const seq = getAttr(doutorado, 'SEQUENCIA-FORMACAO')!;
    for (const f of [...formacoes, ...all(lattes.state.root, 'POS-DOUTORADO')]) {
      lattes.state.privacy.set(f, f === doutorado ? '1' : '2');
    }
    const form = await lattes.port.get(`pkg_formacao.form?f_cod=${code}&f_seq=${seq}&f_tipo=FA`);
    expect(form).toContain('var contPriv = "0"');
    expect(form).toContain('PKG_FORMACAO.SETA_ULTIMO_PUBLICO');
    expect(form).toContain("dc.f_ctr.value = 'E'");

    const seta = (op = 'E') =>
      lattes.port.post(
        'PKG_FORMACAO.SETA_ULTIMO_PUBLICO',
        `f_cod=${code}&f_seq=${seq}&f_tipo=FA&f_op=${op}`,
      );
    expect(await seta('X')).toBe('ERRO');
    expect(await seta()).toBe('SETOU');
    // A concluída mais recente entre as outras (o pós-doutorado, 2018) ficou pública.
    const posDoc = all(lattes.state.root, 'POS-DOUTORADO')[0]!;
    expect(lattes.state.privacy.get(posDoc)).toBe('1');
    expect(formacoes.filter((f) => lattes.state.privacy.get(f) === '1')).toEqual([doutorado]);
    expect(await seta()).toBe('ULTIMO');

    await lattes.port.post('pkg_formacao.FORM', `f_ctr=E&f_cod=${code}&f_seq=${seq}&f_tipo=FA`);
    expect(all(lattes.state.root, 'DOUTORADO')).toHaveLength(0);
  });

  it('formação complementar: o FORM2 em dois passos, e exclusão', async () => {
    const lattes = await start();
    const code = lattes.state.code;
    const root = lattes.state.root;
    const dc = lattes.state.ensurePath(['DADOS-COMPLEMENTARES', 'FORMACAO-COMPLEMENTAR']);
    dc.children.push({
      attrs: [
        { name: 'SEQUENCIA-FORMACAO', value: '7' },
        { name: 'NIVEL', value: 'F' },
        { name: 'NOME-CURSO', value: 'Curso de R' },
      ],
      children: [],
      kind: 'element',
      name: 'FORMACAO-COMPLEMENTAR-CURSO-DE-CURTA-DURACAO',
      selfClosing: true,
    });
    const list = await lattes.port.get(`pkg_formacao_compl.lista?f_cod=${code}`);
    const row = findLinks(list, 'PKG_FORMACAO_COMPL.form')[0]!;
    const form = await lattes.port.get(row.path);
    expect(field(form, 'GN_FORMACAO2', 'f_ctr')?.value).toBe('');
    expect(field(form, 'GN_FORMACAO2', 'f_nivel')?.selected).toEqual(['F']);
    expect(form).toContain('PKG_FORMACAO_COMPL.SETA_ULTIMO_PUBLICO');

    // O primeiro passo (f_ctr vazio) só devolve o segundo, sem gravar (27/10/2026).
    const step2 = await lattes.port.post(
      'PKG_FORMACAO_COMPL.FORM2',
      `f_ctr=&f_cod=${code}&f_seq=7&f_nivel=E`,
    );
    expect(field(step2, 'GN_FORMACAO2', 'f_ctr')?.value).toBe('U');
    expect(all(root, 'MBA')).toHaveLength(0);
    const saved = await lattes.port.post(
      'PKG_FORMACAO_COMPL.FORM2',
      `f_ctr=U&f_cod=${code}&f_seq=7&f_nivel=E&f_ano_ini=2018`,
    );
    expect(saved).toMatch(/realizada com sucesso/);
    expect(all(root, 'MBA').map((el) => getAttr(el, 'NIVEL'))).toEqual(['E']);
    expect(getAttr(all(root, 'MBA')[0]!, 'ANO-DE-INICIO')).toBe('2018');
    await lattes.port.post('PKG_FORMACAO_COMPL.FORM2', `f_ctr=E&f_cod=${code}&f_seq=7&f_tipo=`);
    expect(all(root, 'MBA')).toHaveLength(0);
  });
});

describe('Lattes simulado: projetos e a busca de órgão', () => {
  it('lista por natureza, inclusão pela atuação escolhida e alteração', async () => {
    const lattes = await start();
    const code = lattes.state.code;
    const atuacao = all(lattes.state.root, 'ATUACAO-PROFISSIONAL')[0]!;
    atuacao.attrs = atuacao.attrs.map((a) =>
      a.name === 'CODIGO-INSTITUICAO' ? { ...a, value: '000000000001' } : a,
    );

    const list = await lattes.port.get(`pkg_projeto.lista?f_cod_tipo=P&f_cod=${code}`);
    const links = findLinks(list, 'PKG_PROJETO.form');
    expect(links.filter((l) => l.params.f_seq_proj)).toHaveLength(1);
    const inclusion = links.find((l) => !l.params.f_seq_proj)!;
    expect(inclusion.params).toMatchObject({ f_cod_tipo: 'P', f_tematica: 'X' });
    const empty = await lattes.port.get(inclusion.path);
    expect(field(empty, 'GN_PROJETO', 'f_ctr')?.value).toBe('I');
    expect(field(empty, 'GN_PROJETO', 'f_inst')).toMatchObject({ disabled: true, maxLength: 75 });

    const inst = await lattes.port.get(`PKG_PROJETO.pp_lista_inst?f_pgm=INSTVINCULO&f_cod=${code}`);
    const [args] = jsCalls(inst, 'preencherOpener');
    expect(args).toHaveLength(9);
    expect(args!.slice(7)).toEqual(['V000000000001', 'Universidade Federal do Rio Grande do Sul']);

    await lattes.port.post(
      'PKG_PROJETO.FORM',
      `f_ctr=I&f_cod=${code}&f_cod_tipo=E&f_cod_inst=000000000001&f_titulo=Extens%E3o+em+escolas&F_TPO_NATUREZA=E&F_TPO_SITUACAO=A&F_ANO_INIC=2026`,
    );
    const projetos = all(lattes.state.root, 'PROJETO-DE-PESQUISA');
    expect(projetos.map((p) => getAttr(p, 'NOME-DO-PROJETO'))).toContain('Extensão em escolas');
    const extensao = await lattes.port.get(`pkg_projeto.lista?f_cod_tipo=E&f_cod=${code}`);
    const row = findLinks(extensao, 'PKG_PROJETO.form').find((l) => l.params.f_seq_proj)!;
    const form = await lattes.port.get(row.path);
    expect(field(form, 'GN_PROJETO', 'f_ctr')?.value).toBe('U');
    expect(field(form, 'GN_PROJETO', 'f_cod_inst')?.value).toBe('000000000001');
    await lattes.port.post(
      'PKG_PROJETO.FORM',
      `f_ctr=U&f_cod=${code}&f_seq_proj=${row.params.f_seq_proj}&f_titulo=Novo+nome&F_TPO_NATUREZA=E&F_TPO_SITUACAO=C&F_ANO_INIC=2026&F_ANO_FIM=2026&f_instituicoes=%3Croot%3E%3C%2Froot%3E`,
    );
    expect(
      all(lattes.state.root, 'PROJETO-DE-PESQUISA').map((p) => getAttr(p, 'SITUACAO')),
    ).toContain('CONCLUIDO');
    // Sem instituição escolhida, a inclusão é recusada.
    expect(
      await lattes.port.post('PKG_PROJETO.FORM', `f_ctr=I&f_cod=${code}&f_titulo=X`),
    ).toContain('Escolha a instituição');

    const orgaos = await lattes.port.get(
      `PKG_PROJETO.pp_orgao_cargo?f_cod=${code}&f_cod_inst=V000000000001`,
    );
    // Como a janela real (18/10/2026): atribuir(código, nome, tipo[, órgão de cima]).
    expect(parseOrgans(orgaos)).toEqual([
      { code: '000001000008', kind: '0', name: 'Instituto de Biociências' },
      { code: '000002000004', kind: '0', name: 'Instituto de Informática' },
    ]);
    const unidades = await lattes.port.get(
      `PKG_PROJETO.pp_orgao_cargo?f_cod=${code}&f_cod_inst=V000000000001&f_cod_inst2=V000001000008`,
    );
    expect(parseOrgans(unidades, '000001000008').map((o) => [o.name, o.parent])).toEqual([
      ['Departamento de Genética', 'Instituto de Biociências'],
      ['Departamento de Botânica', 'Instituto de Biociências'],
    ]);
  });
});

describe('Lattes simulado: patente em dois passos', () => {
  it('janela prévia, consulta do número, formulário com f_ctr=R e inclusão', async () => {
    const lattes = await start();
    const code = lattes.state.code;
    const list = await lattes.port.get(`PKG_PATENTE_REGISTRO.LISTA?f_cod_tipo=PP&f_cod=${code}`);
    expect(list).toContain('Nenhum registro cadastrado');
    expect(list).toContain('pkg_patente_registro.informar_dados_patente?ftipo=PP');
    const prior = await lattes.port.get('pkg_patente_registro.informar_dados_patente?ftipo=PP');
    expect(field(prior, 'fDatpat', 'f_cod_reg')).toMatchObject({ maxLength: 16 });
    expect(prior).toContain('pkg_patente_registro.verifica_cadastrado');

    const check = () =>
      lattes.port.post(
        'pkg_patente_registro.verifica_cadastrado',
        `f_pi=BR102026000001&f_cod=${code}&f_inst=INPI`,
      );
    expect(await check()).toBe('0');
    const form = await lattes.port.get(
      `pkg_patente_registro.form?f_sta_inovacao=&f_cod=${code}&f_cod_tipo=PP&f_inst=INPI&f_cod_reg=BR102026000001&f_ctr=R`,
    );
    expect(form).toContain('value="BR102026000001"');
    expect(form).toContain('action="PKG_PATENTE_REGISTRO.FORM"');
    await lattes.port.post(
      'PKG_PATENTE_REGISTRO.FORM',
      `f_ctr=I&f_cod=${code}&f_cod_tipo=PP&f_inst=INPI&f_cod_reg=BR102026000001&f_titulo=Marcador&f_tipo=PI&f_pais=BRA`,
    );
    expect(await check()).toBe('1');
    const patente = all(lattes.state.root, 'PATENTE')[0]!;
    expect(getAttr(patente, 'SEQUENCIA-PRODUCAO')).toBe(String(lattes.state.nextProduction));
    const after = await lattes.port.get(`PKG_PATENTE_REGISTRO.LISTA?f_cod_tipo=PP&f_cod=${code}`);
    const row = findLinks(after, 'PKG_PATENTE_REGISTRO.form')[0]!;
    const edit = await lattes.port.get(row.path);
    expect(edit).toContain('value="Marcador"');
    await lattes.port.post(
      'PKG_PATENTE_REGISTRO.FORM',
      `f_ctr=E&f_cod=${code}&f_seq=${row.params.f_seq}`,
    );
    expect(all(lattes.state.root, 'PATENTE')).toHaveLength(0);
  });
});
