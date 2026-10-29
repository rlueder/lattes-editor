// O passo que a passada das produções deixou de fora: os projetos (uma
// natureza por item de teste, numa atuação só) e as licenças (um tipo por
// licença), incluídos pelo editor (planChanges e applyOp, com a releitura do
// conector) e depois, com o currículo lido de novo, os campos só de tela e a
// visibilidade privada pela alteração. As licenças não têm título: a limpeza
// as acha pelo que as listas têm a mais que a base (apagar.ts).

import { applyOp, BUILD_GATES } from '../../src/bridge/apply.ts';
import { withScriptValues } from '../../src/bridge/form.ts';
import { readFormInPage } from '../../src/bridge/form-dom.ts';
import { cvCodeFrom, findLinks } from '../../src/bridge/lattes-html.ts';
import { parseOrgans } from '../../src/bridge/lattes-lists.ts';
import { organsPath } from '../../src/bridge/organ-windows.ts';
import { ALL_ON, planChanges } from '../../src/bridge/plan.ts';
import { vinculoChoices } from '../../src/bridge/projeto-atuacoes.ts';
import { LattesTransport } from '../../src/bridge/transport.ts';
import { TEST_MARK } from '../../src/census/test-plan.ts';
import { diffDocuments, pathTo } from '../../src/model/changes.ts';
import { insertInSchemaOrder } from '../../src/model/schema-order.ts';
import { element, firstChild, getAttr, setAttr, walk, type XElement } from '../../src/model/xml.ts';
import { lattesSchema } from '../../src/schema/lattes.ts';
import { connectorPort, reading, state } from './aba.ts';

/** Uma natureza por projeto, com a situação, o potencial e a natureza do financiador em rodízio. */
const PROJECTS = [
  { funder: 'AUXILIO_FINANCEIRO', inovacao: 'SIM', natureza: 'PESQUISA', situacao: 'EM_ANDAMENTO' },
  { funder: 'COOPERACAO', inovacao: 'NAO', natureza: 'DESENVOLVIMENTO', situacao: 'CONCLUIDO' },
  { funder: 'OUTRO', inovacao: 'NAO', natureza: 'EXTENSAO', situacao: 'DESATIVADO' },
  { funder: 'REMUNERACAO', inovacao: 'NAO', natureza: 'ENSINO', situacao: 'EM_ANDAMENTO' },
  { funder: 'BOLSA', inovacao: 'NAO', natureza: 'OUTRA', situacao: 'CONCLUIDO' },
];

/** Um tipo por licença, cada uma num ano, dentro do período que o check() aceita. */
const LICENSES = [
  { birth: '05/01/2001', end: '10/03/2001', start: '10/01/2001', type: 'MATERNIDADE' },
  { birth: '05/01/2002', end: '10/03/2002', start: '10/01/2002', type: 'PATERNIDADE' },
  { birth: '05/01/2003', end: '10/03/2003', start: '10/01/2003', type: 'ADOCAO' },
];

const sameInst = (a: string, b: string) => a.replace(/^[A-Z]/, '') === b.replace(/^[A-Z]/, '');

/** As atuações, onde estiverem (DADOS-GERAIS/ATUACOES-PROFISSIONAIS no XSD). */
function atuacoesOf(root: XElement): XElement[] {
  const out: XElement[] = [];
  walk(root, (e) => {
    if (e.name === 'ATUACAO-PROFISSIONAL') out.push(e);
  });
  return out;
}

/** O filho de nome `name`, criado na ordem do schema quando falta. */
function childOf(parent: XElement, name: string): XElement {
  let next = firstChild(parent, name);
  if (!next) {
    next = element(name);
    insertInSchemaOrder(lattesSchema, parent, next);
  }
  return next;
}

function el(name: string, attrs: Record<string, string>): XElement {
  const e = element(name);
  for (const [k, v] of Object.entries(attrs)) setAttr(e, k, v);
  return e;
}

/** Aplica cada operação planejada, uma tarefa do transporte por operação. */
async function applyAll(
  working: XElement,
  original: XElement,
  extras: Record<string, Record<string, string>>,
) {
  const changes = diffDocuments(original, working);
  const { ops, unsupported } = planChanges(
    changes.map((change) => ({ change, itemTitle: 'passada' })),
    working,
    { ...ALL_ON, extras },
  );
  const out: string[] = unsupported.map((u) => `à mão: ${u.reason.slice(0, 160)}`);
  for (const op of ops) {
    const traffic = new LattesTransport();
    const r = await traffic.run(
      () => applyOp(op, connectorPort(traffic), BUILD_GATES),
      (error) => ({ detail: error.message, key: op.key, status: 'erro' as const }),
    );
    out.push(`${op.kind} ${r.status}: ${r.detail.slice(0, 200)}`);
  }
  return out;
}

/**
 * Os projetos e as licenças de teste, pelo currículo lido (__carregarPonte).
 * `funderName` é a instituição financiadora, achada pela busca do Lattes.
 */
export async function criarProjetos(funderName: string, only?: string[]) {
  const doc = state.loaded?.doc;
  if (!doc) return 'rode __carregarPonte.carregar() antes';
  const menu = document.documentElement.outerHTML;
  const cv = cvCodeFrom(menu) ?? '';
  // A atuação: a primeira do currículo que a janela das atuações do projeto oferece.
  const window = await reading((get) =>
    get(`PKG_PROJETO.pp_lista_inst?f_pgm=INSTVINCULO&f_cod=${cv}`),
  );
  const choices = vinculoChoices(window);
  const atuacoes = atuacoesOf(doc.root);
  // A primeira atuação da janela cuja instituição tem órgão: a inclusão o exige.
  let atuacaoIndex = -1;
  let organ: { code: string; name: string } | undefined;
  let tried = 0;
  for (const [i, a] of atuacoes.entries()) {
    const choice = choices.find((c) => sameInst(c.code, getAttr(a, 'CODIGO-INSTITUICAO') ?? '-'));
    if (!choice) continue;
    tried++;
    const organs = parseOrgans(await reading((get) => get(organsPath(cv, choice.code))));
    organ = organs.find((o) => !o.parent);
    if (organ) {
      atuacaoIndex = i;
      break;
    }
  }
  if (!organ) return { atuacoes: atuacoes.length, janela: choices.length, semOrgao: tried };
  const original = structuredClone(doc.root);
  // Sem licença no currículo, o LICENCAS vazio vai dos dois lados: senão a
  // diferença é o container novo, que o planejamento não inclui.
  childOf(childOf(original, 'DADOS-GERAIS'), 'LICENCAS');
  const working = structuredClone(original);
  const wAtuacao = atuacoesOf(working)[atuacaoIndex]!;
  const extras: Record<string, Record<string, string>> = {};
  for (const [i, p] of PROJECTS.entries()) {
    if (only && !only.includes(p.natureza)) continue;
    const projeto = el('PROJETO-DE-PESQUISA', {
      'ANO-FIM': p.situacao === 'EM_ANDAMENTO' ? '' : '2021',
      'ANO-INICIO': '2020',
      'DESCRICAO-DO-PROJETO': `${TEST_MARK} descrição`,
      'FLAG-POTENCIAL-INOVACAO': p.inovacao,
      NATUREZA: p.natureza,
      'NOME-DO-PROJETO': `${TEST_MARK} PROJETO v${i + 1} ${p.natureza}`,
      'NUMERO-DOUTORADO': '1',
      'NUMERO-ESPECIALIZACAO': '2',
      'NUMERO-GRADUACAO': '3',
      'NUMERO-MESTRADO-ACADEMICO': '4',
      'NUMERO-MESTRADO-PROF': '5',
      SITUACAO: p.situacao,
    });
    const fin = childOf(projeto, 'FINANCIADORES-DO-PROJETO');
    fin.children.push(
      el('FINANCIADOR-DO-PROJETO', { NATUREZA: p.funder, 'NOME-INSTITUICAO': funderName }),
    );
    const part = el('PARTICIPACAO-EM-PROJETO', {
      'ANO-FIM': getAttr(projeto, 'ANO-FIM')!,
      'ANO-INICIO': '2020',
      'CODIGO-ORGAO': organ.code,
      'FLAG-PERIODO': p.situacao === 'EM_ANDAMENTO' ? 'ATUAL' : 'ANTERIOR',
      'NOME-ORGAO': organ.name,
    });
    part.children.push(projeto);
    insertInSchemaOrder(
      lattesSchema,
      childOf(wAtuacao, 'ATIVIDADES-DE-PARTICIPACAO-EM-PROJETO'),
      part,
    );
    if (p.inovacao === 'SIM') {
      extras[pathTo(working, projeto)!.join('/')] = {
        f_txt_potencial: `${TEST_MARK} potencial de inovação`,
      };
    }
  }
  const licencas = childOf(childOf(working, 'DADOS-GERAIS'), 'LICENCAS');
  for (const l of LICENSES) {
    if (only && !only.includes(l.type)) continue;
    const lic = el('LICENCA', {
      'DATA-FIM-LICENCA': l.end.replaceAll('/', ''),
      'DATA-INICIO-LICENCA': l.start.replaceAll('/', ''),
      'DATA-NASCIMENTO-ADOCAO': l.birth.replaceAll('/', ''),
      'FORMATO-DATA-FIM-LICENCA': 'DDMMAAAA',
      'FORMATO-DATA-INICIO-LICENCA': 'DDMMAAAA',
      'TIPO-LICENCA': l.type,
    });
    licencas.children.push(lic);
  }
  const resultado = await applyAll(working, original, extras);
  return { atuacao: atuacaoIndex, resultado };
}

/** Os valores de tela que a segunda rodada põe em cada projeto de teste. */
function screenValues(natureza: string, i: number): Record<string, string> {
  const base = { 'tela:f_tipo_privacidade': '2' };
  if (natureza === 'ENSINO') {
    return {
      ...base,
      'tela:f_tematica': 'EA,AP,PC,FI,IT,AI,IS,PI,MI,A,G,O',
      'tela:f_tpo_acao_inov': 'EF,EM,GR,ES,GM,MP,GD',
      'tela:f_tpo_cooperacao': 'IE,AF,EM',
    };
  }
  // Um projeto com a cooperação com empresa e os dados dela; os outros com Não.
  if (i === 0) {
    return {
      ...base,
      'tela:f_cnpj_empresa': '00.000.000/0001-91',
      'tela:f_tpo_pesq_emp': 'S',
      'tela:f_txt_email_institucional': 'teste@example.com',
      'tela:f_txt_nme_empresa': `${TEST_MARK} empresa`,
      'tela:f_txt_setor': `${TEST_MARK} setor`,
    };
  }
  return { ...base, 'tela:f_tpo_pesq_emp': 'N' };
}

/** A segunda rodada, sobre o currículo lido de novo: os campos só de tela e a visibilidade. */
export async function telaProjetos() {
  const doc = state.loaded?.doc;
  if (!doc) return 'rode __carregarPonte.carregar() antes';
  const original = structuredClone(doc.root);
  const working = structuredClone(doc.root);
  let projetos = 0;
  let licencas = 0;
  walk(working, (e) => {
    if (
      e.name === 'PROJETO-DE-PESQUISA' &&
      (getAttr(e, 'NOME-DO-PROJETO') ?? '').includes(TEST_MARK)
    ) {
      const i = PROJECTS.findIndex((p) => p.natureza === getAttr(e, 'NATUREZA'));
      for (const [k, v] of Object.entries(screenValues(getAttr(e, 'NATUREZA') ?? '', i))) {
        setAttr(e, k, v);
      }
      projetos++;
    }
    // As licenças de teste pelas datas, que nenhuma licença de verdade usa.
    if (
      e.name === 'LICENCA' &&
      LICENSES.some((l) => getAttr(e, 'DATA-INICIO-LICENCA') === l.start.replaceAll('/', ''))
    ) {
      setAttr(e, 'tela:f_tipo_privacidade', '2');
      licencas++;
    }
  });
  const resultado = await applyAll(working, original, {});
  return { licencas, projetos, resultado };
}

/** As escolhas que cada página de teste mostra marcadas, só nos campos de escolha. */
export async function lerTela() {
  const menu = document.documentElement.outerHTML;
  const code = cvCodeFrom(menu) ?? '';
  const out: Record<string, Record<string, string>> = {};
  await reading(async (get) => {
    const lists = [
      ...findLinks(menu, 'pkg_projeto.lista').map((l) => l.path),
      ...findLinks(menu, 'pkg_licenca.lista').map((l) => l.path),
    ];
    for (const list of lists) {
      const html = await get(list.includes('f_cod=') ? list : `${list}&f_cod=${code}`);
      const rows = [
        ...findLinks(html, 'PKG_PROJETO.form'),
        ...findLinks(html, 'pkg_licenca.form'),
      ].filter((l) => Object.keys(l.params).some((k) => /seq/i.test(k)));
      for (const row of rows) {
        const page = await get(row.path);
        const isLicense = /GN_LICENCA/i.test(page);
        const controls =
          withScriptValues(page, readFormInPage(page, isLicense ? 'GN_LICENCA' : 'GN_PROJETO')) ??
          [];
        const title = controls.find((c) => c.name === 'f_titulo')?.value ?? '';
        const start = controls.find((c) => c.name === 'f_dta_inicio')?.value ?? '';
        const mine = isLicense
          ? LICENSES.some((l) => l.start === start)
          : title.includes(TEST_MARK);
        if (!mine) continue;
        const picked: Record<string, string[]> = {};
        for (const c of controls) {
          if (c.type === 'select-one' || c.type === 'select-multiple') {
            (picked[c.name] ??= []).push(...(c.selected ?? []));
          } else if ((c.type === 'radio' || c.type === 'checkbox') && c.checked) {
            (picked[c.name] ??= []).push(c.value);
          } else if (/^f_(cnpj|txt_|dta_nasc)/.test(c.name) && c.value) {
            (picked[c.name] ??= []).push(
              c.name === 'f_cnpj_empresa' ? c.value : c.value.slice(0, 40),
            );
          }
        }
        const label = isLicense
          ? `licença ${start.slice(-4)}`
          : title.slice(TEST_MARK.length + 1, TEST_MARK.length + 40);
        out[label] = Object.fromEntries(Object.entries(picked).map(([k, v]) => [k, v.join(',')]));
        // O que o script da página faz com a licença e o CNPJ.
        const scripts = [...page.matchAll(/[^\n;]*(?:f_tipo_licenca|cnpj)[^\n;]*/gi)]
          .map((m) => m[0].replace(/\s+/g, ' ').trim().slice(0, 140))
          .filter((t) => !/^<(input|select|option|td|label)/i.test(t));
        if (scripts.length) out[label]!.scripts = [...new Set(scripts)].slice(0, 12).join(' | ');
      }
    }
  });
  return out;
}
