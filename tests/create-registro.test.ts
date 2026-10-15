// Inclusão de patente e registros pelo conector (LAT-57): o planejamento e o
// envio de ponta a ponta contra o Lattes simulado, cujos formulários de
// registro saem da captura do censo de 15/10/2026.

import { readFileSync } from 'node:fs';

import { afterEach, describe, expect, it } from 'vitest';

import { DEMO_XML } from '../scripts/lattes-simulado/estado.ts';
import { applyAll, applyOp } from '../src/bridge/apply.ts';
import { checkContract, isBreaking, LATTES_CONTRACT } from '../src/bridge/contract.ts';
import { CREATE_SPECS } from '../src/bridge/create-items.ts';
import {
  type CreateRegistroOp,
  formDate,
  PATENT_BY_HAND,
  patentDateGrid,
  registroFields,
  registryInclusion,
} from '../src/bridge/create-registro.ts';
import { exportCv } from '../src/bridge/export.ts';
import { cvCodeFrom, lattesIdFrom } from '../src/bridge/lattes-html.ts';
import { isOp, planChanges } from '../src/bridge/plan.ts';
import { diffDocuments, resolvePath } from '../src/model/changes.ts';
import { loadCv } from '../src/model/document.ts';
import { generalTypes, insertGeneralItem, newGeneralItem } from '../src/model/general-items.ts';
import {
  childElements,
  element,
  firstChild,
  getAttr,
  setAttr,
  walk,
  type XDocument,
  type XElement,
} from '../src/model/xml.ts';
import { lattesSchema as schema } from '../src/schema/lattes.ts';
import { type LattesSimuladoNoTeste, withLattesSimulado } from './helpers/lattes-simulado.ts';

const DEMO = new Uint8Array(readFileSync(DEMO_XML));
const OWNER = {
  citation: 'LIMA, A. B. S.',
  lattesId: '3871592046158372',
  name: 'Ana Beatriz Souza Lima',
};

let open: LattesSimuladoNoTeste | undefined;
afterEach(async () => {
  await open?.close();
  open = undefined;
});

async function start(options: Parameters<typeof withLattesSimulado>[0] = {}) {
  open = await withLattesSimulado(options);
  return open;
}

const type = (itemName: string) =>
  generalTypes(schema, 'patentes', (n) => n).find((t) => t.itemName === itemName)!;

/** As partes do registro, pelo começo do nome. */
const part = (item: XElement, prefix: string) =>
  childElements(item).find((c) => c.name.startsWith(prefix))!;
const registry = (item: XElement) =>
  firstChild(part(item, 'DETALHAMENTO-'), 'REGISTRO-OU-PATENTE')!;

/** Um registro novo como o editor o monta, com o dono como autor. */
function addRegistro(doc: XDocument, itemName: string, fill: (item: XElement) => void): XElement {
  const t = type(itemName);
  const item = newGeneralItem(schema, t, OWNER);
  fill(item);
  insertGeneralItem(schema, doc, t, item, { productionCounter: 100 });
  return item;
}

/**
 * O que o planejamento faz com o registro novo, e a operação que
 * registroFields() monta para ele: o planejamento ainda o manda à mão pela
 * grade de autores (seção 21), e a operação é a que vai quando ela for lida.
 */
async function plan(edit: (doc: XDocument) => void, on = true) {
  const original = await loadCv(DEMO, 'demo.xml');
  const working = structuredClone(original.doc);
  edit(working);
  const changes = diffDocuments(original.doc.root, working.root);
  const entries = changes.map((change) => ({ change, itemTitle: '' }));
  const planned = planChanges(entries, working.root, { createItems: on });
  const ops: CreateRegistroOp[] = [];
  const unsupported: string[] = [];
  for (const change of changes) {
    const chain = resolvePath(working.root, change.path);
    const container = chain.at(-1)!;
    const item = childElements(container)[0] ?? container;
    const fields = registroFields(change, chain, item);
    if ('reason' in fields) unsupported.push(fields.reason);
    else
      ops.push({
        expect: {},
        key: change.key,
        kind: 'criar-registro',
        label: 'Registro',
        ...fields,
      });
  }
  return { ops, planned, unsupported };
}

const desenho = (item: XElement) => {
  setAttr(part(item, 'DADOS-BASICOS-'), 'TITULO', 'Cadeira dobrável');
  setAttr(part(item, 'DADOS-BASICOS-'), 'PAIS', 'Brasil');
  setAttr(part(item, 'DADOS-BASICOS-'), 'FLAG-POTENCIAL-INOVACAO', 'NAO');
  setAttr(part(item, 'DETALHAMENTO-'), 'FINALIDADE', 'Mobiliário');
  setAttr(part(item, 'DETALHAMENTO-'), 'INSTITUICAO-FINANCIADORA', 'FINEP');
  setAttr(registry(item), 'CODIGO-DO-REGISTRO-OU-PATENTE', 'BR302020001234');
  setAttr(registry(item), 'INSTITUICAO-DEPOSITO-REGISTRO', 'INPI');
  setAttr(registry(item), 'DATA-PEDIDO-DE-DEPOSITO', '01022020');
};

const marcaFill = (item: XElement) => {
  setAttr(part(item, 'DADOS-BASICOS-'), 'TITULO', 'Sabiá');
  setAttr(part(item, 'DADOS-BASICOS-'), 'PAIS', 'Brasil');
  setAttr(part(item, 'DETALHAMENTO-'), 'NATUREZA', 'Nominativa');
  setAttr(registry(item), 'TIPO-PATENTE', 'MARCA_REGISTRADA_DE_PRODUTO_MPD');
  setAttr(registry(item), 'CODIGO-DO-REGISTRO-OU-PATENTE', '912345678');
  setAttr(registry(item), 'INSTITUICAO-DEPOSITO-REGISTRO', 'INPI');
};

async function exportedDoc(lattes: LattesSimuladoNoTeste) {
  await lattes.port.get(
    `pkg_publicar.enviar?f_chk=1&f_idioma=1&f_chk_en=1&f_email_contato=&f_email_alternativo=&f_cod=${lattes.state.code}&f_ctr=U`,
  );
  const menu = await lattes.port.menuHtml();
  const r = await exportCv(lattes.exportPort, cvCodeFrom(menu), lattesIdFrom(menu));
  if (!r.ok) throw new Error(r.reason);
  return (await loadCv(r.bytes, r.fileName)).doc;
}

function findAll(root: XElement, name: string): XElement[] {
  const out: XElement[] = [];
  walk(root, (el) => {
    if (el.name === name) out.push(el);
  });
  return out;
}

describe('planejar a inclusão de um registro', () => {
  it('com a chave ligada o registro vira inclusão; a patente vai à mão pelo titular', async () => {
    expect(LATTES_CONTRACT.forms['criar-registro']).toBeUndefined();
    const edit = (doc: XDocument) => addRegistro(doc, 'DESENHO-INDUSTRIAL', desenho);
    expect((await plan(edit, false)).planned.ops).toEqual([]);
    const { planned } = await plan(edit);
    expect(planned.unsupported).toEqual([]);
    expect(planned.ops.filter(isOp).map((o) => o.kind)).toEqual(['criar-registro']);
    const patente = await plan((doc) =>
      addRegistro(doc, 'PATENTE', (item) => {
        desenho(item);
        setAttr(registry(item), 'TIPO-PATENTE', 'PRIVILEGIO_DE_INOVACAO_PI');
      }),
    );
    expect(patente.planned.unsupported.map((u) => u.reason)).toEqual([PATENT_BY_HAND]);
  });

  it('o desenho industrial leva os campos e a data do registro como dd/mm/aaaa', async () => {
    const { ops, unsupported } = await plan((doc) =>
      addRegistro(doc, 'DESENHO-INDUSTRIAL', desenho),
    );
    expect(unsupported).toEqual([]);
    expect(ops).toEqual([
      expect.objectContaining({
        kind: 'criar-registro',
        set: {
          f_cod_reg: 'BR302020001234',
          f_dta_dep: '01/02/2020',
          f_finalidade: 'Mobiliário',
          f_inst: 'INPI',
          f_inst_financ: 'FINEP',
          f_pais: 'BRA',
          f_sta_inovacao: 'N',
          f_titulo: 'Cadeira dobrável',
        },
        tipo: 'DI',
      }),
    ]);
  });

  it('a patente leva as datas na grade, como array2xml a monta (seção 21)', async () => {
    expect(formDate('01022020')).toBe('01/02/2020');
    expect(formDate('2020-02-01')).toBeUndefined();
    expect(patentDateGrid([{ code: '1', date: '01/02/2020', label: 'Depósito' }])).toBe(
      '<root><item>\n\t<id>1</id>\n\t<contato>Depósito</contato>\n\t<endereco>01/02/2020</endereco>\n</item >\n</root >',
    );
    const { ops } = await plan((doc) =>
      addRegistro(doc, 'PATENTE', (item) => {
        desenho(item);
        setAttr(registry(item), 'TIPO-PATENTE', 'PRIVILEGIO_DE_INOVACAO_PI');
        setAttr(registry(item), 'DATA-DE-CONCESSAO', '05062023');
      }),
    );
    expect(ops[0]!.set.f_dados_grid_datas).toBe(
      patentDateGrid([
        { code: '1', date: '01/02/2020', label: 'Depósito' },
        { code: '3', date: '05/06/2023', label: 'Concessão' },
      ]),
    );
    expect(ops[0]!.set.f_tipo).toBe('PI');
  });

  it('a marca leva o tipo e a natureza; a cultivar, a denominação e o ano de solicitação', async () => {
    const { ops } = await plan((doc) => {
      addRegistro(doc, 'MARCA', (item) => {
        marcaFill(item);
        setAttr(part(item, 'DADOS-BASICOS-'), 'ANO-DESENVOLVIMENTO', '2024');
        setAttr(part(item, 'DETALHAMENTO-'), 'NATUREZA', 'mista');
        setAttr(registry(item), 'TIPO-PATENTE', 'MARCA_REGISTRADA_DE_SERVICO_MSV');
      });
    });
    expect(ops[0]).toMatchObject({
      set: { f_ano: '2024', f_cod_reg: '912345678', f_natureza: 'Mista', f_tipo: 'MSV' },
      tipo: 'MR',
    });
    const cultivar = await plan((doc) => {
      addRegistro(doc, 'CULTIVAR-PROTEGIDA', (item) => {
        setAttr(part(item, 'DADOS-BASICOS-'), 'DENOMINACAO', 'BRS Pitanga');
        setAttr(part(item, 'DADOS-BASICOS-'), 'ANO-SOLICITACAO', '2022');
        setAttr(part(item, 'DADOS-BASICOS-'), 'PAIS', 'Brasil');
        setAttr(registry(item), 'CODIGO-DO-REGISTRO-OU-PATENTE', '20220001');
        setAttr(registry(item), 'INSTITUICAO-DEPOSITO-REGISTRO', 'SNPC');
        setAttr(registry(item), 'DATA-DE-CONCESSAO', '10102022');
      });
    });
    expect(cultivar.ops[0]).toMatchObject({
      set: {
        f_ano: '2022',
        f_cod_reg: '20220001',
        f_dta_conc: '10/10/2022',
        f_titulo: 'BRS Pitanga',
      },
      tipo: 'CP',
    });
  });

  it('o que não tem como ir pelo formulário vai à mão, com o motivo', async () => {
    const reason = async (itemName: string, fill: (item: XElement) => void) => {
      const r = await plan((doc) => addRegistro(doc, itemName, fill));
      expect(r.ops, itemName).toEqual([]);
      return r.unsupported[0]!;
    };
    // Marca e topografia: nenhum campo de data na tela (seção 21).
    expect(
      await reason('MARCA', (item) => {
        marcaFill(item);
        setAttr(registry(item), 'DATA-PEDIDO-DE-DEPOSITO', '01022024');
      }),
    ).toBe('Campos que o formulário de inclusão não tem: DATA-PEDIDO-DE-DEPOSITO');
    expect(
      await reason('DESENHO-INDUSTRIAL', (item) => {
        desenho(item);
        setAttr(registry(item), 'DATA-PEDIDO-DE-DEPOSITO', '2024');
      }),
    ).toMatch(/Valores sem correspondência.*\(2024\)/);
    expect(
      await reason('PATENTE', (item) => {
        desenho(item);
        setAttr(registry(item), 'TIPO-PATENTE', 'PRIVILEGIO_DE_INOVACAO_PI');
        setAttr(registry(item), 'DATA-PEDIDO-DE-DEPOSITO', '');
      }),
    ).toMatch(/data de depósito ou a de depósito PCT/);
    expect(
      await reason('DESENHO-INDUSTRIAL', (item) => {
        desenho(item);
        setAttr(part(item, 'DETALHAMENTO-'), 'FINALIDADE', '');
      }),
    ).toBe('O Lattes exige a finalidade');
    expect(
      await reason('MARCA', (item) => {
        marcaFill(item);
        setAttr(part(item, 'DETALHAMENTO-'), 'NATUREZA', '');
      }),
    ).toBe('O Lattes exige a natureza');
    // O desenho industrial não tem ano no formulário (o f_ano é oculto).
    expect(
      await reason('DESENHO-INDUSTRIAL', (item) => {
        desenho(item);
        setAttr(part(item, 'DADOS-BASICOS-'), 'ANO-DESENVOLVIMENTO', '2020');
      }),
    ).toBe('Campos que o formulário de inclusão não tem: Ano de desenvolvimento');
    expect(
      await reason('DESENHO-INDUSTRIAL', (item) => {
        desenho(item);
        setAttr(part(item, 'DADOS-BASICOS-'), 'FLAG-POTENCIAL-INOVACAO', 'SIM');
      }),
    ).toMatch(/Valores sem correspondência no formulário: .*\(SIM\)/);
    expect(
      await reason('MARCA', (item) => {
        marcaFill(item);
        setAttr(registry(item), 'TIPO-PATENTE', 'MARCA_REGISTRADA_MISTA_MRM');
      }),
    ).toMatch(/MARCA_REGISTRADA_MISTA_MRM/);
    expect(
      await reason('DESENHO-INDUSTRIAL', (item) => {
        desenho(item);
        setAttr(part(item, 'DADOS-BASICOS-'), 'FLAG-RELEVANCIA', 'SIM');
      }),
    ).toMatch(/Campos que o formulário de inclusão não tem/);
    expect(
      await reason('DESENHO-INDUSTRIAL', (item) => {
        desenho(item);
        const autor = firstChild(item, 'AUTORES')!;
        setAttr(autor, 'NOME-COMPLETO-DO-AUTOR', 'Outra Pessoa');
        setAttr(autor, 'NRO-ID-CNPQ', '');
      }),
    ).toMatch(/Autores além de você/);
    expect(
      await reason('DESENHO-INDUSTRIAL', (item) => {
        desenho(item);
        item.children.push(element('PALAVRAS-CHAVE', { 'PALAVRA-CHAVE-1': 'design' }));
      }),
    ).toMatch(/Palavras-chave/);
    expect(
      await reason('TOPOGRAFIA-DE-CIRCUITO-INTEGRADO', (item) =>
        setAttr(part(item, 'DADOS-BASICOS-'), 'TITULO', 'Chip'),
      ),
    ).toMatch(/exige título .* número, instituição de registro e país/);
  });
});

describe('incluir registros no Lattes simulado', () => {
  it('inclui cultivar, desenho, marca e topografia, confere e a exportação traz cada um', async () => {
    const lattes = await start();
    const { ops, unsupported } = await plan((doc) => {
      addRegistro(doc, 'CULTIVAR-REGISTRADA', (item) => {
        setAttr(part(item, 'DADOS-BASICOS-'), 'DENOMINACAO', 'BRS Butiá');
        setAttr(part(item, 'DADOS-BASICOS-'), 'ANO-SOLICITACAO', '2023');
        setAttr(part(item, 'DADOS-BASICOS-'), 'PAIS', 'Brasil');
        setAttr(registry(item), 'CODIGO-DO-REGISTRO-OU-PATENTE', '45678');
        setAttr(registry(item), 'INSTITUICAO-DEPOSITO-REGISTRO', 'MAPA');
      });
    });
    expect(unsupported).toEqual([]);
    const results = await applyAll(ops, lattes.port);
    expect(results.map((r) => r.status)).toEqual(['conferido']);
    expect(results[0]!.detail).toMatch(
      /^Criado e conferido no Lattes \(registro \d+; inventores não relidos\)$/,
    );
    expect(results[0]!.assigned).toEqual({ 'SEQUENCIA-PRODUCAO': expect.any(String) });
    // A própria pessoa vai na grade de inventores, pela linha dela no autorDP do menu.
    const post = lattes.state.log.filter((l) => l.method === 'POST').at(-1)!;
    expect(post.pairs?.find(([k]) => k === 'f_autores_l')?.[1]).toBe(
      `${OWNER.name}||${lattes.state.general.attrs.find((a) => a.name === 'NOME-EM-CITACOES-BIBLIOGRAFICAS')?.value.split(';')[0]}`,
    );

    const others = await plan((doc) => {
      addRegistro(doc, 'DESENHO-INDUSTRIAL', desenho);
    });
    const marca = await plan((doc) => addRegistro(doc, 'MARCA', marcaFill));
    const topografia = await plan((doc) => {
      addRegistro(doc, 'TOPOGRAFIA-DE-CIRCUITO-INTEGRADO', (item) => {
        setAttr(part(item, 'DADOS-BASICOS-'), 'TITULO', 'Conversor AD');
        setAttr(part(item, 'DADOS-BASICOS-'), 'ANO-DESENVOLVIMENTO', '2021');
        setAttr(part(item, 'DADOS-BASICOS-'), 'PAIS', 'Brasil');
        setAttr(part(item, 'DETALHAMENTO-'), 'INSTITUICAO-FINANCIADORA', 'FINEP');
        setAttr(part(item, 'DETALHAMENTO-'), 'FINALIDADE', 'Instrumentação');
        setAttr(registry(item), 'CODIGO-DO-REGISTRO-OU-PATENTE', 'BR132021000011');
        setAttr(registry(item), 'INSTITUICAO-DEPOSITO-REGISTRO', 'INPI');
      });
    });
    const all = [...others.ops, ...marca.ops, ...topografia.ops];
    expect(all.map((o) => (o as CreateRegistroOp).tipo)).toEqual(['DI', 'MR', 'TC']);
    const done = await applyAll(all, lattes.port);
    expect(done.map((r) => r.status)).toEqual(['conferido', 'conferido', 'conferido']);

    const doc = await exportedDoc(lattes);
    const [di] = findAll(doc.root, 'DESENHO-INDUSTRIAL');
    expect(getAttr(part(di!, 'DADOS-BASICOS-'), 'TITULO')).toBe('Cadeira dobrável');
    expect(getAttr(part(di!, 'DADOS-BASICOS-'), 'PAIS')).toBe('Brasil');
    expect(getAttr(registry(di!), 'CODIGO-DO-REGISTRO-OU-PATENTE')).toBe('BR302020001234');
    const [mr] = findAll(doc.root, 'MARCA');
    expect(getAttr(registry(mr!), 'TIPO-PATENTE')).toBe('MARCA_REGISTRADA_DE_PRODUTO_MPD');
    expect(getAttr(part(mr!, 'DETALHAMENTO-'), 'NATUREZA')).toBe('Nominativa');
    const [cr] = findAll(doc.root, 'CULTIVAR-REGISTRADA');
    expect(getAttr(firstChild(cr!, 'AUTORES')!, 'NOME-COMPLETO-DO-AUTOR')).toBe(OWNER.name);
    expect(getAttr(part(cr!, 'DADOS-BASICOS-'), 'DENOMINACAO')).toBe('BRS Butiá');
    expect(getAttr(part(cr!, 'DADOS-BASICOS-'), 'ANO-SOLICITACAO')).toBe('2023');
    const [tc] = findAll(doc.root, 'TOPOGRAFIA-DE-CIRCUITO-INTEGRADO');
    expect(getAttr(part(tc!, 'DETALHAMENTO-'), 'INSTITUICAO-FINANCIADORA')).toBe('FINEP');

    // Mandar o desenho de novo: o número já está no Lattes, nada é enviado.
    const posts = lattes.state.log.filter((l) => l.method === 'POST').length;
    const [again] = await applyAll(others.ops, lattes.port);
    expect(again).toMatchObject({
      detail: 'O Lattes já tem um registro com esse número',
      status: 'divergente',
    });
    expect(lattes.state.log.filter((l) => l.method === 'POST').length).toBe(posts);
  });

  it('gravado diferente não é conferido; lista com dois novos diz que pode ter criado', async () => {
    const lattes = await start({
      intercept: async (req, state, next) => {
        const out = await next();
        if (req.method === 'POST' && /^pkg_patente_registro\.form$/i.test(req.proc)) {
          const [item] = findAll(state.root, 'DESENHO-INDUSTRIAL');
          if (item) setAttr(part(item, 'DADOS-BASICOS-'), 'TITULO', 'Outro título');
        }
        return out;
      },
    });
    const { ops } = await plan((doc) => addRegistro(doc, 'DESENHO-INDUSTRIAL', desenho));
    const [r] = await applyAll(ops, lattes.port);
    expect(r).toMatchObject({ status: 'divergente' });
    expect(r!.detail).toMatch(/^Criado no Lattes \(registro \d+\), mas gravado diferente: Título$/);

    const twice = await start({
      intercept: async (req, _state, next) => {
        if (req.method === 'POST' && /^pkg_patente_registro\.form$/i.test(req.proc)) await next();
        return next();
      },
    });
    const [r2] = await applyAll(ops, twice.port);
    expect(r2).toMatchObject({ status: 'divergente' });
    expect(r2!.detail).toMatch(/a lista mostra 2 registros novos.*confira no Lattes/);
  });

  it('sem a lista no menu, sem inclusão na lista ou com outro formulário, para sem enviar', async () => {
    const op = (tipo: string): CreateRegistroOp => ({
      expect: {},
      key: 'k',
      kind: 'criar-registro',
      label: 'Registro',
      set: { f_cod_reg: '1', f_titulo: 'X' },
      tipo,
    });
    const lattes = await start();
    expect(await applyOp(op('ZZ'), lattes.port)).toMatchObject({
      detail: 'A lista deste registro não está no menu do Lattes',
      status: 'erro',
    });
    const noLink = await start({
      intercept: async (req, _state, next) => {
        const out = await next();
        if (/lista$/i.test(req.proc) && 'html' in out) {
          return {
            ...out,
            html: out.html.replace(/PKG_PATENTE_REGISTRO\.form\?f_reg=[^']*/g, 'x'),
          };
        }
        return out;
      },
    });
    expect(await applyOp(op('CR'), noLink.port)).toMatchObject({
      detail: 'Inclusão não encontrada na lista do Lattes',
      status: 'erro',
    });
    const noOwner = await start({
      intercept: async (req, _state, next) => {
        const out = await next();
        return /pkg_menu\.menu/i.test(req.proc) && 'html' in out
          ? { ...out, html: out.html.replace(/var autorDP = [^;]*;/, '') }
          : out;
      },
    });
    expect(await applyOp(op('CR'), noOwner.port)).toMatchObject({
      detail: 'A sua linha de autor não está no menu do Lattes (autorDP)',
      status: 'erro',
    });
    // Campo que o formulário do tipo não tem: para antes do POST.
    const bad = { ...op('CR'), set: { ...op('CR').set, f_finalidade: 'x' } };
    expect(await applyOp(bad, lattes.port)).toMatchObject({
      detail: 'O formulário deste registro não tem: Finalidade',
      status: 'erro',
    });
    const long = { ...op('CR'), set: { ...op('CR').set, f_cod_reg: '1'.repeat(17) } };
    expect((await applyOp(long, lattes.port)).detail).toMatch(/passa do limite do Lattes \(16/);
  });

  it('a patente abre o formulário pelo endereço da janela prévia, sem f_ctr=R', async () => {
    expect(registryInclusion('', 'PP', 'K000000000')).toBe(
      'pkg_patente_registro.form?f_sta_inovacao=&f_cod=K000000000&f_cod_tipo=PP',
    );
    const lattes = await start();
    const r = await applyOp(
      {
        expect: {},
        key: 'k',
        kind: 'criar-registro',
        label: 'Patente',
        set: { f_cod_reg: 'BR102024000001', f_inst: 'INPI', f_titulo: 'Invento' },
        tipo: 'PP',
      },
      lattes.port,
    );
    expect(r.status).toBe('conferido');
    expect(findAll(lattes.state.root, 'PATENTE')).toHaveLength(1);
  });

  it('a sessão que cai no envio para a fila', async () => {
    const lattes = await start({ expireAfterRequests: 3 });
    const { ops } = await plan((doc) => addRegistro(doc, 'DESENHO-INDUSTRIAL', desenho));
    const [r] = await applyAll(ops, lattes.port);
    expect(r?.status).toBe('sessao');
  });

  it('o contrato do formulário de inclusão bate com o simulado', async () => {
    const lattes = await start();
    const report = await checkContract(lattes.port, {
      forms: { ...LATTES_CONTRACT.forms, 'criar-registro': CREATE_SPECS['criar-registro'] },
      menu: LATTES_CONTRACT.menu,
    });
    const form = report.forms.find((f) => f.kind === 'criar-registro')!;
    expect(form.status).toBe('ok');
    expect(form.drifts.filter(isBreaking)).toEqual([]);
  });
});
