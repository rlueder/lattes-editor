// A recaptura avulsa do censo (LAT-57): os scripts da página sem dado pessoal,
// os endereços que a página abre e as páginas que ainda não são entrada do
// censo, abertas só com GET.

import { describe, expect, it } from 'vitest';

import { LOGON_REDIRECT } from '../scripts/lattes-simulado/html.ts';
import type { ServerOptions } from '../scripts/lattes-simulado/servidor.ts';
import { authorShape } from '../src/census/author-shape.ts';
import { pageLinks, pageScripts, publicPath } from '../src/census/census-page.ts';
import { ACTIVITY_NATURES, inspectActivities, inspectPages } from '../src/census/inspect.ts';
import { type CensusPort, runCensus } from '../src/census/run.ts';
import { decodeLatin1 } from '../src/model/latin1.ts';
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

describe('scripts da página, sem dado pessoal', () => {
  it('tira e-mail, CPF, números longos, textos pedidos e as linhas de dados das grades', () => {
    const html = `<script src="jquery.js"></script>
<script>
var f_cpf = '123.456.789-01'; var id = 3871592046158372;
var url = 'pkg_x.form?f_cod=K123456789&f_ctr=I';
var email = "ana@exemplo.org";
var autorProvider = [{l:'Coautora Qualquer', c:'', t:'QUALQUER, C.'}];
var nome = 'Ana Beatriz Souza Lima'; var outro = 'ANA BEATRIZ SOUZA LIMA';
var semAcento = 'Ana Beatriz Souza Lima'.normalize();
function grade(){ return array2xml("item","root",dados); }
if (!/^\\d{2}\\/\\d{2}\\/\\d{4}$/.test(f.f_dta_dep.value)) alert('Data inválida');
</script><script>   </script>`;
    const [script, ...rest] = pageScripts(html, ['Ana Beatriz Souza Lima']);
    expect(rest).toEqual([]);
    const lines = script!.split('\n');
    expect(lines[0]).toBe("var f_cpf = '[removido]'; var id = [removido];");
    expect(lines[1]).toBe("var url = 'pkg_x.form?f_cod=[removido]&f_ctr=I';");
    expect(lines[2]).toBe('var email = "[removido]";');
    expect(lines[3]).toBe('[removido]');
    expect(lines[4]).toBe("var nome = '[removido]'; var outro = '[removido]';");
    expect(lines.slice(6)).toEqual([
      'function grade(){ return array2xml("item","root",dados); }',
      "if (!/^\\d{2}\\/\\d{2}\\/\\d{4}$/.test(f.f_dta_dep.value)) alert('Data inválida');",
    ]);
    // O nome sem acento ou com outra caixa, que a troca direta não pega, leva o pedaço inteiro.
    expect(
      pageScripts('<script>x = "ána beatriz souza lima";</script>', ['Ana Beatriz Souza Lima']),
    ).toEqual(['[removido]']);
  });

  it('os endereços do Lattes que a página abre, sem o código nem números de item', () => {
    const html = `<a onclick="self.parent.modalCV2.setarUrl('PKG_PATENTE_REGISTRO.form?f_reg=&amp;f_cod=K123456789&amp;f_cod_tipo=CR&amp;f_seq=4',true)">x</a>
<form action="PKG_PATENTE_REGISTRO.FORM"></form><script>location='prc_bib_traducao?f_cod=K1';</script>`;
    expect(pageLinks(html)).toEqual([
      'PKG_PATENTE_REGISTRO.FORM',
      'PKG_PATENTE_REGISTRO.form?f_reg=&f_cod_tipo=CR',
      'prc_bib_traducao',
    ]);
  });
});

describe('o que a primeira recaptura deixou passar (15/10/2026)', () => {
  it('o f_id com o identificador de 16 dígitos sai do endereço', () => {
    expect(
      pageLinks(
        `<a href="pkg_import_cv.form01?F_STA_AVISO=&amp;f_sta_prod=&amp;f_id=3871592046158372">x</a>`,
      ),
    ).toEqual(['pkg_import_cv.form01?F_STA_AVISO=&f_sta_prod=']);
    // Qualquer valor com cara de identificador também, mesmo noutro parâmetro.
    expect(publicPath('pkg_x.form', { f_outro: '12345678901', f_tipo: 'PC' })).toBe(
      'pkg_x.form?f_outro=[removido]&f_tipo=PC',
    );
  });

  it('nomes e citações em JSON comentado e autores nomeados nos comentários', () => {
    const html = `<script>
// exemplo: [{"n":"Maria da Silva Souza","t":"SOUZA, M. S.","c":""}]
/* modelo antigo
   {'nome': 'Joao Pereira', "citacao": "PEREIRA, J."}
   comentado por Ricardo Alves em 2019 */
var x = 1; // Criado por: Fernanda Lima Costa
// alterado por Paulo  -- não mexer
// lista de autores e coautores (sem nome aqui)
var label = { l: rotulo, t: citado };
</script>`;
    const lines = pageScripts(html)[0]!.split('\n');
    expect(lines[0]).toBe('// exemplo: [{"n":"[removido]","t":"[removido]","c":""}]');
    expect(lines[2]).toBe(`   {'nome': '[removido]', "citacao": "[removido]"}`);
    expect(lines[3]).toBe('   comentado por [removido] em 2019 */');
    expect(lines[4]).toBe('var x = 1; // Criado por: [removido]');
    expect(lines[5]).toBe('// alterado por [removido]  -- não mexer');
    // Sem nome próprio, o comentário fica como está, e o código também.
    expect(lines[6]).toBe('// lista de autores e coautores (sem nome aqui)');
    expect(lines[7]).toBe('var label = { l: rotulo, t: citado };');
  });

  it('a lista de coautores da janela de equipe e o título com o nome da instituição', () => {
    const html = `<script>
p[0]="3#silva maria@SILVA, M. (Maria Silva)";
p[11]='11#outro nome@NOME, O. (Outro Nome)';
self.parent.modalCV9.setarTitulo("Atuação profissional - Atividades (Ensino)<br>Universidade Federal do Exemplo", true );
self.parent.modalCV1.setarTitulo("Atuação profissional - Linhas de pesquisa");
var x = "a#b";
</script>`;
    expect(pageScripts(html)[0]!.split('\n')).toEqual([
      'p[0]="3#[removido]@[removido]";',
      "p[11]='11#[removido]@[removido]';",
      'self.parent.modalCV9.setarTitulo("Atuação profissional - Atividades (Ensino)<br>[removido]", true );',
      'self.parent.modalCV1.setarTitulo("Atuação profissional - Linhas de pesquisa");',
      'var x = "a#b";',
    ]);
  });

  it('a forma das linhas de autor do menu, sem nome nenhum', () => {
    const shape = authorShape(
      [
        { c: '', deletable: false, l: 'Ána Silva', t: 'SILVA, A.' },
        { c: 'K4790210P3', deletable: true, l: 'Coautora', t: 'COAUTORA, C.' },
        { c: 'K4790210P4', deletable: true, l: 'Outra', t: 'OUTRA, O.' },
        'lixo',
      ],
      'Ana Silva',
    );
    expect(shape).toEqual({
      codePatterns: { '': 1, A9999999A9: 2 },
      keyOrders: { 'c,deletable,l,t': 3 },
      owner: { codePattern: '', keys: ['c', 'deletable', 'l', 't'], matches: 1 },
      total: 4,
    });
    expect(JSON.stringify(shape)).not.toMatch(/Silva|Coautora|K479/);
    expect(authorShape(undefined)).toEqual({ codePatterns: {}, keyOrders: {}, total: 0 });
  });
});

describe('recaptura avulsa contra o Lattes simulado', () => {
  it('abre só com GET, guarda formulário, scripts e links, e nunca o código', async () => {
    const { lattes, port } = await simulado();
    try {
      const file = await inspectPages(
        port,
        lattes.state.code,
        [
          'PKG_PATENTE_REGISTRO.form?f_cod_tipo=CR&f_reg=&F_STA_DIVULGACAO_CIENTIFICA=',
          { noCode: true, path: 'pkg_patente_registro.informar_dados_patente?ftipo=PP' },
          'pkg_publicar.enviar?f_chk=1',
        ],
        { delayMs: 0, now: () => new Date('2026-10-15T12:00:00Z'), redact: ['Ana Beatriz'] },
      );
      expect(file.entries.map((e) => [e.id, e.status])).toEqual([
        ['avulsa-1', 'ok'],
        ['avulsa-2', 'ok'],
        ['avulsa-3', 'erro'],
      ]);
      const [cr, janela] = file.entries;
      expect(cr!.label).toBe(
        'PKG_PATENTE_REGISTRO.form?f_cod_tipo=CR&f_reg=&F_STA_DIVULGACAO_CIENTIFICA=',
      );
      expect(cr!.page?.forms[0]?.name).toBe('PKG_PATENTE_REGISTRO');
      expect(cr!.links).toContain('PKG_PATENTE_REGISTRO.FORM');
      expect(janela!.path).toBe('pkg_patente_registro.informar_dados_patente?ftipo=PP');
      const scripts = janela!.scripts!.map((id) => file.scripts![id]!);
      expect(scripts.join('\n')).toContain('function handlePatenteSubmit()');
      const text = JSON.stringify(file);
      expect(text).not.toContain(lattes.state.code);
      expect(text).not.toMatch(/\d{16}/);
    } finally {
      await lattes.close();
    }
  });

  it('caminho com f_cod não ganha outro f_cod', async () => {
    const { lattes, port } = await simulado();
    try {
      const file = await inspectPages(
        port,
        lattes.state.code,
        [`pkg_premio.form?f_cod=${lattes.state.code}`],
        {
          delayMs: 0,
        },
      );
      expect(file.entries[0]).toMatchObject({ path: 'pkg_premio.form', status: 'ok' });
    } finally {
      await lattes.close();
    }
  });

  it('as atividades de cada natureza, pelo link da tela de cargos e vínculos', async () => {
    const { lattes, port } = await simulado();
    try {
      const file = await inspectActivities(port, lattes.state.code, { delayMs: 0 });
      expect(file.entries.map((e) => e.path)).toEqual(
        ACTIVITY_NATURES.map((n) => `pkg_ativ.cargo?f_natur_ativ=${n}`),
      );
      expect(file.entries.every((e) => e.status === 'ok')).toBe(true);
      expect(JSON.stringify(file)).not.toContain(lattes.state.code);
    } finally {
      await lattes.close();
    }
  });

  it('sem atuação com o link de atividade, diz por quê', async () => {
    const { lattes, port } = await simulado({
      intercept: async (req, _state, next) => {
        const out = await next();
        return /cargos_vinculos/i.test(req.proc) && 'html' in out
          ? { ...out, html: out.html.replace(/pkg_ativ\.cargo\?/g, 'x?') }
          : out;
      },
    });
    try {
      await expect(inspectActivities(port, lattes.state.code, { delayMs: 0 })).rejects.toThrow(
        /link de inclusão de atividade/,
      );
      const noMenu: CensusPort = { ...port, menuHtml: () => '<html></html>' };
      await expect(inspectActivities(noMenu, lattes.state.code, { delayMs: 0 })).rejects.toThrow(
        /lista de atuações/,
      );
    } finally {
      await lattes.close();
    }
  });

  it('sessão caída no meio: o resto fica como não lido', async () => {
    const { lattes, port } = await simulado({
      intercept: async (req, _state, next) =>
        /patente_registro\.form/i.test(req.proc) ? { html: LOGON_REDIRECT } : next(),
    });
    try {
      const file = await inspectPages(
        port,
        lattes.state.code,
        ['PKG_PATENTE_REGISTRO.form?f_cod_tipo=CR', 'pkg_premio.form'],
        { delayMs: 0 },
      );
      expect(file.interrupted).toBe(true);
      expect(file.entries.map((e) => e.status)).toEqual(['nao-lido', 'nao-lido']);
      expect(file.scripts).toBeUndefined();
    } finally {
      await lattes.close();
    }
  });

  it('o censo com a opção scripts guarda cada script uma vez, citado pelo id', async () => {
    const { lattes, port } = await simulado();
    try {
      const file = await runCensus(port, lattes.state.code, {
        delayMs: 0,
        only: ['registro-CR', 'registro-DI'],
        scripts: true,
      });
      const [cr, di] = file.entries;
      expect(cr!.scripts?.length).toBeGreaterThan(0);
      expect(di!.scripts).toEqual(cr!.scripts);
      expect(Object.keys(file.scripts!)).toEqual(cr!.scripts);
      expect(
        (await runCensus(port, lattes.state.code, { delayMs: 0, only: ['registro-CR'] })).scripts,
      ).toBeUndefined();
    } finally {
      await lattes.close();
    }
  });
});
