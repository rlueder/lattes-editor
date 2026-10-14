import { describe, expect, it } from 'vitest';

import { applyOp, type LattesPort } from '../src/bridge/apply.ts';
import {
  BIOGRAPHIC_OPS_ENABLED,
  BIOGRAPHIC_SPECS,
  biographicContract,
  type BiographicOp,
  biographicSample,
  planBiographic,
} from '../src/bridge/biographic.ts';
import {
  blocksKind,
  checkContract,
  type Contract,
  type FieldSpec,
  LATTES_CONTRACT,
} from '../src/bridge/contract.ts';
import { opRows } from '../src/bridge/field-labels.ts';
import type { FormControl } from '../src/bridge/form.ts';
import { planChanges } from '../src/bridge/plan.ts';
import { sentEntry, undoOp } from '../src/bridge/sent-log.ts';
import { diffDocuments, resolvePath } from '../src/model/changes.ts';
import { parseXml, setAttr, type XElement } from '../src/model/xml.ts';

const XML = `<CURRICULO-VITAE NUMERO-IDENTIFICADOR="1">
<DADOS-GERAIS NOME-COMPLETO="Pessoa de Teste" NACIONALIDADE="B" SEXO="MASCULINO">
<RESUMO-CV TEXTO-RESUMO-CV-RH="Resumo"/>
<ENDERECO FLAG-DE-PREFERENCIA="ENDERECO_INSTITUCIONAL">
<ENDERECO-PROFISSIONAL NOME-INSTITUICAO-EMPRESA="Universidade" LOGRADOURO-COMPLEMENTO="Rua A, 1" PAIS="Brasil" UF="RS" CEP="90000000" CIDADE="Porto Alegre" BAIRRO="Centro" DDD="51" TELEFONE="33330000" RAMAL="" FAX="" CAIXA-POSTAL="" E-MAIL="a@example.org" HOME-PAGE=""/>
<ENDERECO-RESIDENCIAL LOGRADOURO="Rua B, 2" PAIS="Brasil" UF="RS" CEP="96000000" CIDADE="Pelotas" BAIRRO="Fragata" DDD="" TELEFONE="" RAMAL="" FAX="" CAIXA-POSTAL="" E-MAIL="" HOME-PAGE=""/>
</ENDERECO>
<FORMACAO-ACADEMICA-TITULACAO>
<GRADUACAO SEQUENCIA-FORMACAO="2" NIVEL="1" TITULO-DO-TRABALHO-DE-CONCLUSAO-DE-CURSO="TCC" NOME-INSTITUICAO="UFPel" STATUS-DO-CURSO="CONCLUIDO" ANO-DE-INICIO="2001" ANO-DE-CONCLUSAO="2004"/>
<MESTRADO SEQUENCIA-FORMACAO="1" NIVEL="3" NOME-INSTITUICAO="PUCRS" STATUS-DO-CURSO="EM_ANDAMENTO" ANO-DE-INICIO="2006" ANO-DE-CONCLUSAO="" ANO-DE-OBTENCAO-DO-TITULO="" TITULO-DA-DISSERTACAO-TESE="Dissertação" NOME-COMPLETO-DO-ORIENTADOR="Orientador"/>
<POS-DOUTORADO SEQUENCIA-FORMACAO="9" NIVEL="P" ANO-DE-INICIO="2010" ANO-DE-CONCLUSAO=""/>
</FORMACAO-ACADEMICA-TITULACAO>
</DADOS-GERAIS></CURRICULO-VITAE>`;

function find(root: XElement, name: string): XElement {
  const stack = [root];
  while (stack.length) {
    const el = stack.pop()!;
    if (el.name === name) return el;
    for (const c of el.children) if (c.kind === 'element') stack.push(c);
  }
  throw new Error(name);
}

function plan(edit: (root: XElement) => void, enabled = true, xml = XML) {
  const original = parseXml(xml).root;
  const working = parseXml(xml).root;
  edit(working);
  const entries = diffDocuments(original, working).map((change) => ({ change, itemTitle: 'X' }));
  return planChanges(entries, working, { biographicOps: enabled });
}

function onlyOp(edit: (root: XElement) => void, xml = XML): BiographicOp {
  const planned = plan(edit, true, xml);
  expect(planned.unsupported).toEqual([]);
  expect(planned.ops).toHaveLength(1);
  return planned.ops[0] as BiographicOp;
}

const editMestrado = (attrs: Record<string, string>) => (root: XElement) => {
  const el = find(root, 'MESTRADO');
  for (const [k, v] of Object.entries(attrs)) setAttr(el, k, v);
};

// ---------------------------------------------------------------- planejar

describe('dados gerais: chave desligada', () => {
  it('fica desligada por padrão e manda tudo à mão', () => {
    expect(BIOGRAPHIC_OPS_ENABLED).toBe(false);
    for (const kind of ['formacao', 'endereco', 'identificacao'] as const) {
      expect(LATTES_CONTRACT.forms[kind]).toBeUndefined();
    }
    for (const proc of ['pkg_formacao.lista', 'prc_endereco', 'prc_ident']) {
      expect(LATTES_CONTRACT.menu).not.toContain(proc);
    }
    expect(biographicContract()).toEqual({ forms: {}, menu: [] });
    const edit = (root: XElement) => {
      setAttr(find(root, 'MESTRADO'), 'ANO-DE-CONCLUSAO', '2007');
      setAttr(find(root, 'ENDERECO-RESIDENCIAL'), 'BAIRRO', 'Centro');
      setAttr(find(root, 'DADOS-GERAIS'), 'NOME-COMPLETO', 'Outro Nome');
    };
    const off = plan(edit, false);
    expect(off.ops).toEqual([]);
    expect(off.unsupported.map((u) => u.reason)).toEqual([
      'Formulário não suportado ainda',
      'Formulário não suportado ainda',
      'Formulário não suportado ainda',
    ]);
    // Sem a opção, vale a chave do módulo (desligada).
    const original = parseXml(XML).root;
    const working = parseXml(XML).root;
    edit(working);
    const entries = diffDocuments(original, working).map((change) => ({ change, itemTitle: '' }));
    expect(planChanges(entries, working).ops).toEqual([]);
    expect(
      plan(edit)
        .ops.map((o) => o.kind)
        .sort(),
    ).toEqual(['endereco', 'formacao', 'identificacao']);
  });
});

describe('dados gerais: formação acadêmica', () => {
  it('leva anos, situação e título, com nível e início para conferir', () => {
    const op = onlyOp(
      editMestrado({
        'ANO-DE-CONCLUSAO': '2007',
        'ANO-DE-OBTENCAO-DO-TITULO': '2007',
        'STATUS-DO-CURSO': 'CONCLUIDO',
        'TITULO-DA-DISSERTACAO-TESE': 'Dissertação revista',
      }),
    );
    expect(op).toMatchObject({
      expect: {
        F_STATUS: 'N',
        f_ano_fim: '',
        f_ano_ini: '2006',
        f_ano_obten: '',
        f_nivel: '3',
        f_titulo: 'Dissertação',
      },
      kind: 'formacao',
      seq: '1',
      set: {
        F_STATUS: 'S',
        f_ano_fim: '2007',
        f_ano_obten: '2007',
        f_titulo: 'Dissertação revista',
      },
    });
    // O início alterado vai no set e confere o valor antigo.
    const start = onlyOp(editMestrado({ 'ANO-DE-INICIO': '2005' }));
    expect(start.expect.f_ano_ini).toBe('2006');
    expect(start.set.f_ano_ini).toBe('2005');
    // Graduação: o título é o do trabalho de conclusão.
    const grad = onlyOp((root) =>
      setAttr(find(root, 'GRADUACAO'), 'TITULO-DO-TRABALHO-DE-CONCLUSAO-DE-CURSO', 'Novo TCC'),
    );
    expect(grad).toMatchObject({
      expect: { f_nivel: '1' },
      seq: '2',
      set: { f_titulo: 'Novo TCC' },
    });
  });

  it('situação vazia é nenhum rádio marcado', () => {
    const op = onlyOp(editMestrado({ 'STATUS-DO-CURSO': '' }));
    expect(op.set.F_STATUS).toBeNull();
  });

  it('recusa o que não sabe fazer, com o motivo', () => {
    const reasons = (edit: (root: XElement) => void) => plan(edit).unsupported.map((u) => u.reason);
    expect(reasons(editMestrado({ 'NOME-INSTITUICAO': 'Outra' }))).toEqual([
      expect.stringMatching(/^Campos não suportados ainda: /),
    ]);
    expect(reasons(editMestrado({ 'STATUS-DO-CURSO': 'TRANCADO' }))).toEqual([
      'Situação do curso não mapeada: TRANCADO',
    ]);
    expect(
      reasons((root) => {
        const el = find(root, 'MESTRADO');
        setAttr(el, 'NIVEL', '');
        setAttr(el, 'ANO-DE-CONCLUSAO', '2007');
      }),
    ).toEqual([expect.stringMatching(/sem número de sequência ou nível/)]);
    // Pós-doutorado fica na outra lista (f_tipo=AP), que não foi lida.
    expect(
      reasons((root) => setAttr(find(root, 'POS-DOUTORADO'), 'ANO-DE-CONCLUSAO', '2012')),
    ).toEqual(['Formulário não suportado ainda']);
  });
});

describe('dados gerais: endereço e identificação', () => {
  it('endereço profissional vai nos campos _i, residencial nos _r', () => {
    const prof = onlyOp((root) => {
      const el = find(root, 'ENDERECO-PROFISSIONAL');
      setAttr(el, 'LOGRADOURO-COMPLEMENTO', 'Rua C, 3');
      setAttr(el, 'TELEFONE', '33331111');
    });
    expect(prof).toMatchObject({
      expect: { f_fone_i: '33330000', f_rua_i: 'Rua A, 1' },
      kind: 'endereco',
      set: { f_fone_i: '33331111', f_rua_i: 'Rua C, 3' },
    });
    const res = onlyOp((root) => setAttr(find(root, 'ENDERECO-RESIDENCIAL'), 'CEP', '96010000'));
    expect(res.set).toEqual({ f_cep_r: '96010000' });
    expect(opRows(res)).toEqual([
      { after: '96010000', before: '96000000', label: 'CEP (residencial)', name: 'f_cep_r' },
    ]);
  });

  it('o logradouro de cada endereço vai no campo dele, sem um sobrescrever o outro', () => {
    const res = onlyOp((root) =>
      setAttr(find(root, 'ENDERECO-RESIDENCIAL'), 'LOGRADOURO', 'Rua D'),
    );
    expect(res.set).toEqual({ f_rua_r: 'Rua D' });
    // O atributo do outro elemento, se aparecer, não cai no mesmo campo.
    const both = plan((root) => {
      const el = find(root, 'ENDERECO-PROFISSIONAL');
      setAttr(el, 'LOGRADOURO-COMPLEMENTO', 'Rua E');
      setAttr(el, 'LOGRADOURO', 'Rua F');
    });
    expect(both.ops).toEqual([]);
    expect(both.unsupported.map((u) => u.reason)).toEqual([
      expect.stringMatching(/^Campos não suportados ainda: /),
    ]);
    // Dois títulos no mesmo item da formação também não passam.
    const titles = plan(
      editMestrado({
        'TITULO-DA-DISSERTACAO-TESE': 'Nova',
        'TITULO-DA-MONOGRAFIA': 'Outra',
      }),
    );
    expect(titles.ops).toEqual([]);
  });

  it('país, instituição e preferência de endereço seguem à mão', () => {
    const reasons = plan((root) => {
      setAttr(find(root, 'ENDERECO-RESIDENCIAL'), 'PAIS', 'Portugal');
      setAttr(find(root, 'ENDERECO'), 'FLAG-DE-PREFERENCIA', 'ENDERECO_RESIDENCIAL');
    }).unsupported.map((u) => u.reason);
    expect(reasons.sort()).toEqual([
      expect.stringMatching(/^Campos não suportados ainda: /),
      'Formulário não suportado ainda',
    ]);
  });

  it('identificação leva só o nome, conferindo a nacionalidade', () => {
    const op = onlyOp((root) => setAttr(find(root, 'DADOS-GERAIS'), 'NOME-COMPLETO', 'Outro Nome'));
    expect(op).toMatchObject({
      expect: { f_nacionalidade: 'B', f_nome: 'Pessoa de Teste' },
      kind: 'identificacao',
      set: { f_nome: 'Outro Nome' },
    });
    expect(opRows(op)[0]).toMatchObject({ label: 'Nome completo' });
    // Sem nacionalidade B ou E no XML, não há com o que conferir: segue à mão.
    for (const xml of [XML.replace('NACIONALIDADE="B" ', ''), XML.replace('"B"', '""')]) {
      expect(
        plan(
          (root) => setAttr(find(root, 'DADOS-GERAIS'), 'NOME-COMPLETO', 'Outro Nome'),
          true,
          xml,
        ).unsupported.map((u) => u.reason),
      ).toEqual(['Nacionalidade sem código B ou E no XML: não dá para conferir']);
    }
    expect(
      plan((root) => setAttr(find(root, 'DADOS-GERAIS'), 'SEXO', 'FEMININO')).unsupported,
    ).toEqual([expect.objectContaining({ reason: expect.stringMatching(/não suportados ainda/) })]);
  });

  it('só planeja alteração de um elemento que ainda existe', () => {
    const root = parseXml(XML).root;
    const change = {
      element: 'MESTRADO',
      fields: [],
      form: 'Mestrado',
      key: 'k',
      kind: 'novo' as const,
      path: ['CURRICULO-VITAE'],
    };
    expect(planBiographic(change, [root], 'X')).toBeUndefined();
    expect(planBiographic({ ...change, kind: 'alterado' }, [], 'X')).toBeUndefined();
    const path = resolvePath(root, ['CURRICULO-VITAE', 'DADOS-GERAIS', 'RESUMO-CV[#0]']);
    expect(
      planBiographic({ ...change, element: 'RESUMO-CV', kind: 'alterado' }, path, 'X'),
    ).toBeUndefined();
  });
});

// ---------------------------------------------------------------- Lattes falso

function decodeForm(body: string): [string, string][] {
  return body.split('&').map((part) => {
    const [k, v = ''] = part.split('=');
    const dec = (s: string) =>
      s
        .replace(/\+/g, ' ')
        .replace(/%([0-9A-F]{2})/gi, (_, h: string) => String.fromCharCode(parseInt(h, 16)));
    return [dec(k!), dec(v)];
  });
}

interface FakeOptions {
  /** O formulário vem em outro modo. */
  ctr?: string;
  /** f_nacionalidade como o GET a traz (o JavaScript da página preenche). */
  nacionalidade?: string;
  /** Sem formação nenhuma na lista. */
  noFormacao?: boolean;
  /** O POST também muda outro campo. */
  sideEffect?: [string, string];
}

/** Um Lattes falso com a lista de formação, o endereço e a identificação. */
function fakeLattes(opts: FakeOptions = {}) {
  const formacao = (seq: string, nivel: string, values: Record<string, string>) => ({
    f_ano_fim: '',
    f_ano_ini: '',
    f_ano_obten: '',
    f_cod: 'K000000000',
    f_ctr: opts.ctr ?? 'U',
    f_nivel: nivel,
    f_seq: seq,
    f_tipo: 'FA',
    f_titulo: '',
    F_STATUS: '',
    ...values,
  });
  const forms: Record<string, Record<string, string>> = {
    'formacao:1': formacao('1', '3', {
      f_ano_ini: '2006',
      f_titulo: 'Dissertação',
      F_STATUS: 'N',
    }),
    'formacao:2': formacao('2', '1', {
      f_ano_fim: '2004',
      f_ano_ini: '2001',
      f_titulo: 'TCC',
      F_STATUS: 'S',
    }),
    endereco: {
      ...Object.fromEntries(
        Object.keys(BIOGRAPHIC_SPECS.endereco.fields).map((name) => [name, '']),
      ),
      f_bairro_i: 'Centro',
      f_bairro_r: 'Fragata',
      f_cep_i: '90000000',
      f_cep_r: '96000000',
      f_ctr: opts.ctr ?? 'U',
      f_ddd_i: '51',
      f_email_i: 'a@example.org',
      f_estado_i: 'RS',
      f_estado_r: 'RS',
      f_fone_i: '33330000',
      f_munic_i: 'Porto Alegre',
      f_munic_r: 'Pelotas',
      f_rua_i: 'Rua A, 1',
      f_rua_r: 'Rua B, 2',
    },
    identificacao: {
      f_ctr: opts.ctr ?? 'U',
      f_nacionalidade: opts.nacionalidade ?? 'B',
      f_nome: 'Pessoa de Teste',
    },
  };
  const posts: { body: string; path: string }[] = [];

  const controls = (kind: keyof typeof BIOGRAPHIC_SPECS, state: Record<string, string>) => {
    const out: FormControl[] = [];
    // Os campos do contrato, mais os do estado que ficaram fora dele (o ano de
    // obtenção e o título da formação), como texto.
    const fields: Record<string, FieldSpec> = {
      ...Object.fromEntries(Object.keys(state).map((name) => [name, { type: 'text' }])),
      ...BIOGRAPHIC_SPECS[kind].fields,
    };
    for (const [name, spec] of Object.entries(fields)) {
      if (spec.type === 'radio') {
        for (const v of ['N', 'S', 'I']) {
          out.push({ checked: state[name] === v, name, type: 'radio', value: v });
        }
        continue;
      }
      out.push({ maxLength: spec.maxLength, name, type: spec.type, value: state[name] ?? '' });
    }
    return out;
  };

  const formacaoLinks = opts.noFormacao
    ? ''
    : `<a href="pkg_formacao.form?f_cod=K000000000&amp;f_seq=1&amp;f_tipo=FA">Mestrado</a>
       <a href="pkg_formacao.form?f_cod=K000000000&amp;f_seq=2&amp;f_tipo=FA">Graduação</a>`;

  const port: LattesPort = {
    async get(path) {
      if (path.startsWith('pkg_formacao.lista')) {
        return `${formacaoLinks}<a href="pkg_formacao.form?f_cod=K000000000&amp;f_tipo=FA&amp;f_nivel=9">Incluir</a>`;
      }
      if (path.startsWith('pkg_formacao.form')) {
        return `FORM:formacao:${/f_seq=(\d+)/.exec(path)?.[1] ?? ''}`;
      }
      if (path.startsWith('prc_endereco')) return 'FORM:endereco';
      if (path.startsWith('prc_ident')) return 'FORM:identificacao';
      return '';
    },
    menuHtml: () =>
      `<a onclick="modalCV1.setarUrl(&quot;pkg_formacao.lista?f_cod=K000000000&amp;f_tipo=AP&quot;, true)">Pós</a>
       <a onclick="modalCV1.setarUrl(&quot;pkg_formacao.lista?f_cod=K000000000&amp;f_tipo=FA&quot;, true)">Formação</a>
       <a onclick="modalCV1.setarUrl(&quot;prc_endereco?f_cod=K000000000&quot;, true)">Endereço</a>
       <a onclick="modalCV1.setarUrl(&quot;prc_ident?f_cod=K000000000&amp;f_pcd=N&quot;, true)">Identificação</a>`,
    async post(path, body) {
      posts.push({ body, path });
      const pairs = decodeForm(body);
      const key =
        path === 'pkg_formacao.FORM'
          ? `formacao:${pairs.find(([k]) => k === 'f_seq')?.[1]}`
          : path === 'PRC_ENDERECO'
            ? 'endereco'
            : 'identificacao';
      const state = forms[key]!;
      for (const name of Object.keys(state)) {
        state[name] = pairs.find(([k]) => k === name)?.[1] ?? '';
      }
      if (opts.sideEffect) state[opts.sideEffect[0]] = opts.sideEffect[1];
      return '<script>self.parent.modalCV1.setarUrl("x", true)</script>';
    },
    readForm(html, form) {
      const key = /^FORM:(.+)$/.exec(html)?.[1];
      const state = key && forms[key];
      if (!state) return undefined;
      const kind = key.split(':')[0] as keyof typeof BIOGRAPHIC_SPECS;
      return form === BIOGRAPHIC_SPECS[kind].name ? controls(kind, state) : undefined;
    },
  };
  return { forms, port, posts };
}

const mestradoOp = () =>
  onlyOp(
    editMestrado({
      'ANO-DE-CONCLUSAO': '2007',
      'STATUS-DO-CURSO': 'CONCLUIDO',
      'TITULO-DA-DISSERTACAO-TESE': 'Dissertação revista',
    }),
  );

describe('dados gerais no Lattes falso', () => {
  it('formação: acha a linha pelo f_seq, envia só os campos e confere', async () => {
    const fake = fakeLattes();
    expect(await applyOp(mestradoOp(), fake.port)).toMatchObject({ status: 'conferido' });
    expect(fake.posts.map((p) => p.path)).toEqual(['pkg_formacao.FORM']);
    expect(fake.forms['formacao:1']).toMatchObject({
      f_ano_fim: '2007',
      f_ano_ini: '2006',
      f_nivel: '3',
      f_titulo: 'Dissertação revista',
      F_STATUS: 'S',
    });
    // A outra formação ficou como estava.
    expect(fake.forms['formacao:2']).toMatchObject({ f_titulo: 'TCC', F_STATUS: 'S' });
  });

  it('formação: desfazer volta ao que estava', async () => {
    const fake = fakeLattes();
    const op = mestradoOp();
    expect(await applyOp(op, fake.port)).toMatchObject({ status: 'conferido' });
    const undo = undoOp({ ...sentEntry(op, '1', 1), id: 7 })!;
    expect(undo.set).toMatchObject({ f_ano_fim: '', f_titulo: 'Dissertação', F_STATUS: 'N' });
    expect(await applyOp(undo, fake.port)).toMatchObject({ status: 'conferido' });
    expect(fake.forms['formacao:1']).toMatchObject({
      f_ano_fim: '',
      f_titulo: 'Dissertação',
      F_STATUS: 'N',
    });
  });

  it('formação: para antes de enviar quando algo não confere', async () => {
    // Nível diferente: a linha do Lattes não é a que o editor pensa.
    const wrong = fakeLattes();
    wrong.forms['formacao:1']!.f_nivel = '4';
    expect(await applyOp(mestradoOp(), wrong.port)).toMatchObject({
      detail: expect.stringMatching(/f_nivel/),
      status: 'divergente',
    });
    expect(wrong.posts).toEqual([]);
    // Sem a linha na lista.
    const none = fakeLattes({ noFormacao: true });
    expect(await applyOp(mestradoOp(), none.port)).toMatchObject({
      detail: 'Formação 1 não encontrada no Lattes (0 achadas)',
      status: 'erro',
    });
    // Sem a lista no menu.
    const noMenu = { ...fakeLattes().port, menuHtml: () => '<p>menu</p>' };
    expect(await applyOp(mestradoOp(), noMenu)).toMatchObject({
      detail: 'Formação acadêmica não encontrada no menu do Lattes',
      status: 'erro',
    });
    // Fora do modo de alteração.
    expect(await applyOp(mestradoOp(), fakeLattes({ ctr: 'I' }).port)).toMatchObject({
      detail: expect.stringMatching(/modo de alteração/),
      status: 'erro',
    });
    // Sessão caída na lista.
    const logon = {
      ...fakeLattes().port,
      get: async () => "<script>location = 'pkg_sec.logon?f_cod=ini';</script>",
    };
    expect(await applyOp(mestradoOp(), logon)).toMatchObject({ status: 'sessao' });
  });

  it('endereço: grava só o residencial e confere que o resto não mudou', async () => {
    const fake = fakeLattes();
    const op = onlyOp((root) => setAttr(find(root, 'ENDERECO-RESIDENCIAL'), 'BAIRRO', 'Centro'));
    expect(await applyOp(op, fake.port)).toMatchObject({ status: 'conferido' });
    expect(fake.posts.map((p) => p.path)).toEqual(['PRC_ENDERECO']);
    expect(fake.forms.endereco).toMatchObject({ f_bairro_i: 'Centro', f_bairro_r: 'Centro' });
    const side = fakeLattes({ sideEffect: ['f_rua_i', 'outra'] });
    expect(await applyOp(op, side.port)).toMatchObject({
      detail: 'Outros campos mudaram no Lattes: f_rua_i',
      status: 'erro',
    });
    const noMenu = { ...fakeLattes().port, menuHtml: () => '<p>menu</p>' };
    expect(await applyOp(op, noMenu)).toMatchObject({
      detail: 'Endereço não encontrado no menu do Lattes',
      status: 'erro',
    });
  });

  it('endereço: o limite do campo vale antes de enviar', async () => {
    const fake = fakeLattes();
    const op = onlyOp((root) =>
      setAttr(find(root, 'ENDERECO-PROFISSIONAL'), 'CEP', '9'.repeat(16)),
    );
    expect(await applyOp(op, fake.port)).toMatchObject({
      detail: 'f_cep_i passa do limite do Lattes (15 caracteres)',
      status: 'erro',
    });
    expect(fake.posts).toEqual([]);
  });

  it('identificação: grava o nome; com a nacionalidade vazia no GET, não envia', async () => {
    const op = onlyOp((root) => setAttr(find(root, 'DADOS-GERAIS'), 'NOME-COMPLETO', 'Outro Nome'));
    const fake = fakeLattes();
    expect(await applyOp(op, fake.port)).toMatchObject({ status: 'conferido' });
    expect(fake.forms.identificacao).toMatchObject({ f_nacionalidade: 'B', f_nome: 'Outro Nome' });
    const empty = fakeLattes({ nacionalidade: '' });
    expect(await applyOp(op, empty.port)).toMatchObject({
      detail: expect.stringMatching(/f_nacionalidade/),
      status: 'divergente',
    });
    expect(empty.posts).toEqual([]);
  });
});

// ---------------------------------------------------------------- contrato

const contractOn = (): Contract => {
  const extra = biographicContract(true);
  return {
    forms: { ...LATTES_CONTRACT.forms, ...extra.forms },
    menu: [...LATTES_CONTRACT.menu, ...extra.menu],
  };
};

describe('dados gerais no contrato', () => {
  it('com a chave ligada, confere os três formulários só lendo', async () => {
    const fake = fakeLattes();
    const report = await checkContract(fake.port, contractOn());
    for (const kind of ['endereco', 'identificacao']) {
      expect(report.forms.find((f) => f.kind === kind)).toMatchObject({ status: 'ok' });
    }
    // Ano de obtenção e título ficam fora do contrato (não existem em todo
    // nível): na formação que tem, aparecem como campo novo, que não trava.
    const formacao = report.forms.find((f) => f.kind === 'formacao')!;
    expect(formacao.drifts.map((d) => [d.kind, d.field])).toEqual([
      ['campo-novo', 'f_ano_obten'],
      ['campo-novo', 'f_titulo'],
    ]);
    expect(blocksKind(report, 'formacao')).toEqual([]);
    // O Lattes falso só tem os links dos dados gerais no menu.
    expect(report.menu.filter((m) => m.found).map((m) => m.proc)).toEqual([
      'pkg_formacao.lista',
      'prc_endereco',
      'prc_ident',
    ]);
    expect(fake.posts).toEqual([]);
  });

  it('aponta modo errado, formação sem exemplar e link sumido', async () => {
    const wrongMode = await checkContract(fakeLattes({ ctr: 'I' }).port, contractOn());
    expect(wrongMode.forms.find((f) => f.kind === 'identificacao')?.drifts).toContainEqual(
      expect.objectContaining({ expected: 'U', kind: 'modo-mudou', observed: 'I' }),
    );
    const empty = await checkContract(fakeLattes({ noFormacao: true }).port, contractOn());
    expect(empty.forms.find((f) => f.kind === 'formacao')).toMatchObject({
      detail: 'O currículo não tem formação acadêmica',
      status: 'sem-amostra',
    });
    const noMenu = { ...fakeLattes().port, menuHtml: () => '<p>menu</p>' };
    const gone = await checkContract(noMenu, contractOn());
    for (const [kind, proc] of [
      ['formacao', 'pkg_formacao.lista'],
      ['endereco', 'prc_endereco'],
      ['identificacao', 'prc_ident'],
    ]) {
      expect(gone.forms.find((f) => f.kind === kind)).toMatchObject({
        drifts: [expect.objectContaining({ field: proc, kind: 'link-sumiu' })],
        status: 'nao-encontrado',
      });
    }
  });

  it('o exemplar da formação ignora a lista de pós-doutorado e o link de inclusão', async () => {
    const fake = fakeLattes();
    const found = await biographicSample('formacao', await fake.port.menuHtml(), fake.port.get);
    expect(found).toEqual({ path: 'pkg_formacao.form?f_cod=K000000000&f_seq=1&f_tipo=FA' });
    const sample = await biographicSample(
      'identificacao',
      await fake.port.menuHtml(),
      fake.port.get,
    );
    expect(sample).toEqual({ path: 'prc_ident?f_cod=K000000000&f_pcd=N' });
  });
});
