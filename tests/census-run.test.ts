import { describe, expect, it } from 'vitest';

import { LOGON_REDIRECT } from '../scripts/lattes-simulado/html.ts';
import type { ServerOptions } from '../scripts/lattes-simulado/servidor.ts';
import type { LattesLink } from '../src/bridge/lattes-html.ts';
import {
  buildPath,
  type CensusEntry,
  type CensusPort,
  inclusionLink,
  isSafeGet,
  listPath,
  pageShape,
  pathKey,
  publicOf,
  runCensus,
  shareLists,
  splitAtQuery,
} from '../src/census/run.ts';
import type { CensusTarget } from '../src/census/targets.ts';
import { CENSUS_TARGETS } from '../src/census/targets-production.ts';
import { decodeLatin1 } from '../src/model/latin1.ts';
import { withLattesSimulado } from './helpers/lattes-simulado.ts';

/** A porta do censo como a da aba (extension/src/censo.ts), contra o Lattes simulado. */
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

const byId = (entries: CensusEntry[], id: string) => entries.find((e) => e.id === id)!;

describe('censo: caminhos', () => {
  it('só GET seguro: nada que publica, importa, exporta ou leva f_ctr', () => {
    expect(isSafeGet('pkg_formacao.form?f_cod=K&f_tipo=FA&f_nivel=3')).toBe(true);
    expect(isSafeGet('pkg_ativ.form?f_cod=K&f_seq_ativ=1&f_ctr=E2')).toBe(false);
    expect(isSafeGet('pkg_ativ.form?f_cod=K&f_ctr=')).toBe(true);
    // Um segundo "?" não esconde o f_ctr.
    expect(isSafeGet('pkg_ativ.form?a=1?b=2&f_ctr=E2')).toBe(false);
    expect(isSafeGet('pkg_ativ.form?x=1?f_ctr=E')).toBe(false);
    expect(splitAtQuery('p?a=1?b=2')).toEqual(['p', 'a=1?b=2']);
    for (const bad of [
      'pkg_publicar.enviar?f_chk=1',
      'pkg_importa_xml.inicio?f_cod=K',
      'pkg_impcv.get_arquivo?f_cod=K',
      'prc_upload_foto?f_cod=K',
      'PKG_FORMACAO.SETA_ULTIMO_PUBLICO?f_cod=K',
      'pkg_patente_registro.verifica_cadastrado?f_pi=1',
    ]) {
      expect(isSafeGet(bad)).toBe(false);
    }
  });

  it('monta, limpa e compara caminhos', () => {
    expect(buildPath('K', { params: { a: '1', b: '' }, proc: 'p.form' })).toBe(
      'p.form?f_cod=K&a=1&b=',
    );
    expect(publicOf('p.form?f_cod=K&f_seq=3&f_tipo=FA')).toBe('p.form?f_tipo=FA');
    expect(buildPath('K', { noCode: true, params: { ftipo: 'PP' }, proc: 'j' })).toBe('j?ftipo=PP');
    expect(buildPath('K', { noCode: true, params: {}, proc: 'j' })).toBe('j');
    expect(pageShape('<html><script></script><frameset><frame src="a"><iframe></iframe>')).toEqual({
      bytes: 65,
      form: 0,
      frame: 2,
      iframe: 1,
      input: 0,
      script: 1,
      select: 0,
    });
    expect(pathKey('P.FORM?f_cod=K&b=2&A=1')).toBe(pathKey('p.form?a=1&b=2'));
    const links: LattesLink[] = [
      { params: { f_seq_hist: '2' }, path: 'x?f_seq_hist=2', proc: 'x' },
      { params: { f_ctr: 'E' }, path: 'x?f_ctr=E', proc: 'x' },
      { params: { f_seq_ativ: '5' }, path: 'x?f_seq_ativ=5', proc: 'x' },
    ];
    expect(inclusionLink(links, 'f_seq_hist')?.path).toBe('x?f_seq_ativ=5');
    const menu = `<a onclick="setarUrl('pkg_evento.lista?f_sta_divulgacao_cientifica=S&amp;f_cod=K')">
<a onclick="setarUrl('pkg_evento.lista?f_cod=K&amp;x=1')">`;
    expect(listPath(menu, 'K', { params: {}, proc: 'pkg_evento.lista' })).toBe(
      'pkg_evento.lista?f_cod=K&x=1',
    );
    expect(listPath('', 'K', { params: { f_tipo: 'C' }, proc: 'pkg_orient.lista' })).toBe(
      'pkg_orient.lista?f_cod=K&f_tipo=C',
    );
  });

  it('listas longas ficam uma vez só, com o nome do campo', () => {
    const many = Array.from({ length: 12 }, (_, i) => ({ label: `P${i}`, value: String(i) }));
    const other = [...many.slice(1), { label: 'Z', value: 'z' }];
    const field = (options: typeof many) => ({
      label: '',
      name: 'f_pais',
      options,
      type: 'select-one',
    });
    const page = (fields: ReturnType<typeof field>[]) => ({
      forms: [
        { action: '', fields, hidden: [], identity: {}, method: 'post', name: 'A', unnamed: 0 },
      ],
      title: '',
    });
    const entries = [
      { page: page([field(many), field(many)]) },
      { page: page([field(other)]) },
      {},
    ] as unknown as CensusEntry[];
    const lists = shareLists(entries);
    expect(Object.keys(lists)).toEqual(['f_pais', 'f_pais~2']);
    expect(entries[0]!.page!.forms[0]!.fields.map((f) => f.options)).toEqual(['f_pais', 'f_pais']);
    expect(entries[1]!.page!.forms[0]!.fields[0]!.options).toBe('f_pais~2');
  });
});

describe('censo contra o Lattes simulado', () => {
  it('abre cada formulário de inclusão só com GET e guarda o registro sem dados do currículo', async () => {
    const { lattes, port } = await simulado();
    try {
      const file = await runCensus(port, lattes.state.code, {
        collector: 'teste',
        delayMs: 0,
        discover: true,
        now: () => new Date('2026-10-15T12:00:00Z'),
      });
      expect(lattes.state.log.every((l) => l.method === 'GET')).toBe(true);
      expect(lattes.state.log.some((l) => /f_seq=\d/.test(l.path) && /\.form/i.test(l.proc))).toBe(
        false,
      );
      expect(file).toMatchObject({
        capturedAt: '2026-10-15T12:00:00.000Z',
        collector: 'teste',
        format: 1,
      });
      expect(file.entries.map((e) => e.id)).toEqual(CENSUS_TARGETS.map((t) => t.id));
      const text = JSON.stringify(file);
      expect(text).not.toContain(lattes.state.code);
      expect(text).not.toContain(lattes.state.lattesId);
      expect(text).not.toContain(lattes.state.personName);

      expect(byId(file.entries, 'identificacao')).toMatchObject({
        path: 'prc_ident?f_pcd=N',
        status: 'ok',
      });
      expect(byId(file.entries, 'vinculo')).toMatchObject({
        path: 'PKG_ATIV.vinculos',
        status: 'ok',
      });
      expect(byId(file.entries, 'licenca').status).toBe('ok');
      // O simulado abre a inclusão de produção pelo link da lista (producao.ts).
      expect(byId(file.entries, 'artigo-aceito').status).toBe('ok');
      expect(byId(file.entries, 'patente-janela')).toMatchObject({
        path: 'pkg_patente_registro.informar_dados_patente?ftipo=PP',
        status: 'ok',
      });
      // A atividade abre pelo link de selecionarNatureza() da tela de cargos e vínculos.
      expect(byId(file.entries, 'atividade').status).toBe('ok');
      expect(byId(file.entries, 'prefacio-outras')).toMatchObject({ status: 'desconhecido' });

      const tech = byId(file.entries, 'trabalho-tecnico');
      expect(tech.status).toBe('ok');
      const form = tech.page!.forms[0]!;
      expect(form.name).toBe('GN_RELATORIO');
      expect(form.fields.slice(0, 4).map((f) => [f.name, f.label])).toEqual([
        ['F_COD_PROD', 'Natureza'],
        ['f_titulo', 'Título'],
        ['f_ano', 'Ano'],
        ['f_pais', 'País'],
      ]);
      // A lista de países fica uma vez em lists (o evento tem outra, com a opção vazia).
      const ref = form.fields.find((f) => f.name === 'f_pais')!.options as string;
      expect(ref).toMatch(/^f_pais/);
      expect(file.lists[ref]!.find((o) => o.value === 'BRA')?.label).toBe('Brasil');
      expect(form.hidden).toEqual(expect.arrayContaining(['f_autores_l', 'f_area_l']));
      expect(form.identity).toEqual({ f_ctr: 'I' });

      const compl = byId(file.entries, 'formacao-complementar').page!.forms[0]!;
      expect(compl.fields.find((f) => f.name === 'f_nivel')!.options).toContainEqual({
        label: 'Mba',
        value: 'E',
      });
      expect(file.discovered).toEqual([]);
      expect(file.interrupted).toBeUndefined();
    } finally {
      await lattes.close();
    }
  });

  it('sessão que cai no meio: para de pedir e marca o resto como não lido', async () => {
    let calls = 0;
    const { lattes, port } = await simulado({
      intercept: (req, _state, next) =>
        ++calls > 4 && req.method === 'GET' ? { html: LOGON_REDIRECT } : next(),
    });
    try {
      const file = await runCensus(port, lattes.state.code, { delayMs: 0, discover: true });
      expect(file.interrupted).toBe(true);
      const read = file.entries.filter((e) => e.status === 'ok').length;
      expect(read).toBeGreaterThan(0);
      expect(file.entries.at(-1)!.status).toBe('nao-lido');
      expect(file.discovered).toBeUndefined();
    } finally {
      await lattes.close();
    }
  });

  it('only escolhe as entradas; erro de rede vira status; descoberta acha inclusão nova', async () => {
    const { lattes, port } = await simulado();
    try {
      // Falha uma vez só: a segunda tentativa lê o formulário.
      let once = true;
      const blip: CensusPort = {
        ...port,
        get: (path) => {
          if (path.startsWith('pkg_idioma.form') && once) {
            once = false;
            return Promise.reject(new Error('Failed to fetch'));
          }
          return port.get(path);
        },
      };
      const retried = await runCensus(blip, lattes.state.code, { delayMs: 0, only: ['idioma'] });
      expect(retried.entries[0]!.status).toBe('ok');

      const flaky: CensusPort = {
        ...port,
        get: (path) =>
          path.startsWith('pkg_premio')
            ? Promise.reject(new Error(`rede em ${path}`))
            : port.get(path),
        wait: () => Promise.resolve(),
      };
      const file = await runCensus(flaky, lattes.state.code, { only: ['premio', 'projeto'] });
      expect(file.entries.map((e) => e.id)).toEqual([
        'premio',
        'projeto-P',
        'projeto-D',
        'projeto-E',
        'projeto-N',
        'projeto-O',
      ]);
      expect(file.entries[0]).toMatchObject({
        detail: 'rede em pkg_premio.form?f_cod=[código]',
        status: 'erro',
      });

      const few: CensusTarget[] = CENSUS_TARGETS.filter((t) => t.id === 'idioma');
      const found = await runCensus(port, lattes.state.code, {
        delayMs: 0,
        discover: true,
        targets: few,
      });
      expect(found.discovered).toContain('pkg_premio.form');
      expect(found.discovered).not.toContain('pkg_idioma.form');
    } finally {
      await lattes.close();
    }
  });
});
