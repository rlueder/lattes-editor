// Projetos no Lattes simulado (docs/lattes_internals.md, seção 17): as listas
// pkg_projeto.lista por natureza (f_cod_tipo P, D, E, N, O), o formulário
// GN_PROJETO (PKG_PROJETO.form) de inclusão e de alteração, o POST
// PKG_PROJETO.FORM, a lista de instituições das atuações
// (PKG_PROJETO.pp_lista_inst) e a busca de órgão (PKG_PROJETO.pp_orgao_cargo).
//
// Observados: os nomes, tipos e limites dos campos, o link de inclusão, as
// funções preencherOpener() e seleciona() da lista de instituições e o
// endereço e a página da busca de órgão (18/10/2026). Inferidos: o link de
// cada linha da lista, onde o servidor pendura o projeto novo (na atuação da
// instituição escolhida, numa participação em projeto nova) e como o órgão
// escolhido vira CODIGO-ORGAO e CODIGO-UNIDADE da participação (organOf).

import { foldText } from '../../src/model/fold-text.ts';
import { insertInSchemaOrder } from '../../src/model/schema-order.ts';
import {
  childElements,
  element,
  getAttr,
  setAttr,
  walk,
  type XElement,
} from '../../src/model/xml.ts';
import { lattesSchema } from '../../src/schema/lattes.ts';
import { institutionsOf, ORGANS, withLetter } from './buscas.ts';
import { applyFields, attr, type Binding, fixed, mapped, renderFields } from './campos.ts';
import type { LattesState } from './estado.ts';
import * as h from './html.ts';
import type { SimRequest } from './pedido.ts';
import {
  applyProjectLinks,
  applyProjectTeam,
  linkedCodes,
  orientationLookup,
  projectGridScripts,
} from './projeto-grades.ts';
import { html, type Routes, type SimResponse } from './tipos.ts';

const NATURE: Record<string, string> = {
  DESENVOLVIMENTO: 'D',
  ENSINO: 'N',
  EXTENSAO: 'E',
  OUTRA: 'O',
  PESQUISA: 'P',
};
const SITUATION: Record<string, string> = { CONCLUIDO: 'C', DESATIVADO: 'D', EM_ANDAMENTO: 'A' };

interface Placed {
  atuacao: XElement;
  participacao: XElement;
  projeto: XElement;
}

/** Os projetos do currículo, com a atuação e a participação de que pendem. */
export function projetos(state: LattesState): Placed[] {
  const out: Placed[] = [];
  walk(state.root, (el, ancestors) => {
    if (el.name !== 'PROJETO-DE-PESQUISA') return;
    const atuacao = ancestors.find((a) => a.name === 'ATUACAO-PROFISSIONAL');
    const participacao = ancestors.at(-1);
    if (atuacao && participacao) out.push({ atuacao, participacao, projeto: el });
  });
  return out;
}

const bySeq = (state: LattesState, seq: string | undefined) =>
  projetos(state).find((p) => getAttr(p.projeto, 'SEQUENCIA-PROJETO') === seq);

/** O texto do potencial de inovação de cada projeto, que a exportação não traz. */
const potencial = new WeakMap<XElement, string>();

function bindings(state: LattesState, ids: Record<string, string>): Binding[] {
  const none = (name: string, kind: Binding['kind'] = 'hidden', max?: number): Binding => ({
    kind,
    maxLength: max,
    name,
    read: () => '',
  });
  const fromIds = (name: string): Binding => ({
    kind: 'hidden',
    name,
    read: () => ids[name] ?? '',
  });
  const yesNo: [string, string][] = [
    ['S', 'Sim'],
    ['N', 'Não'],
  ];
  return [
    attr('f_titulo', 'NOME-DO-PROJETO', 'text', { maxLength: 255 }),
    attr('f_titulo_en', 'NOME-DO-PROJETO-INGLES', 'text', { maxLength: 255 }),
    attr('f_ref', 'DESCRICAO-DO-PROJETO', 'textarea', { maxLength: 3900 }),
    attr('f_ref_en', 'DESCRICAO-DO-PROJETO-INGLES', 'textarea', { maxLength: 3900 }),
    mapped('F_TPO_NATUREZA', 'NATUREZA', 'select', NATURE, { options: h.capturedList('L7') }),
    mapped('F_TPO_SITUACAO', 'SITUACAO', 'select', SITUATION, { options: h.capturedList('L8') }),
    attr('F_ANO_INIC', 'ANO-INICIO', 'text', { maxLength: 4 }),
    attr('F_ANO_FIM', 'ANO-FIM', 'text', { maxLength: 4 }),
    attr('F_NRO_GRADUACAO', 'NUMERO-GRADUACAO', 'text', { maxLength: 2 }),
    attr('F_NRO_ESPECIALIZACAO', 'NUMERO-ESPECIALIZACAO', 'text', { maxLength: 2 }),
    attr('F_NRO_MESTRADO_ACAD', 'NUMERO-MESTRADO-ACADEMICO', 'text', { maxLength: 2 }),
    attr('F_NRO_MESTRADO_PROF', 'NUMERO-MESTRADO-PROF', 'text', { maxLength: 2 }),
    attr('F_NRO_DOUTORADO', 'NUMERO-DOUTORADO', 'text', { maxLength: 2 }),
    attr('f_nro_tec_nivel_medio', 'NUMERO_TECNICO_NIVEL_MEDIO', 'hidden'),
    none('F_NRO_PRIMEIRO_GRAU'),
    none('F_NRO_SEGUNDO_GRAU'),
    mapped(
      'f_sta_inovacao',
      'FLAG-POTENCIAL-INOVACAO',
      'radio',
      { NAO: 'N', SIM: 'S' },
      {
        options: yesNo,
      },
    ),
    // O texto do potencial fica no Lattes e não vai à exportação: guardado à parte.
    {
      kind: 'text',
      maxLength: 400,
      name: 'f_txt_potencial',
      read: (el) => potencial.get(el) ?? '',
      write: (el, value) => potencial.set(el, value),
    },
    { ...none('f_tpo_pesq_emp', 'radio'), options: yesNo },
    none('f_cnpj_empresa', 'text', 18),
    none('f_txt_nme_empresa', 'text'),
    none('f_txt_email_institucional', 'text'),
    none('f_txt_setor', 'text', 400),
    none('f_cod_inst_empresa'),
    { disabled: true, kind: 'text', maxLength: 75, name: 'f_inst', read: () => ids.inst ?? '' },
    // Na alteração, os ocultos da instituição e do vínculo vêm como a escolha
    // da lista os deixou (inferido: o servidor os relê da atuação).
    ...['f_cod_inst', 'f_cod_inst2', 'f_instold', 'f_inst_old', 'f_instituicoes'].map((n) =>
      fromIds(n),
    ),
    { disabled: true, kind: 'text', name: 'f_orgao', read: () => ids.f_orgao ?? '' },
    ...['f_codorgao', 'f_codorgao2', 'f_orgao_old'].map((n) => none(n)),
    ...['f_vinc', 'f_stavinc', 'f_enqua', 'f_carga', 'f_regime'].map((n) => fromIds(n)),
    fixed('f_tpo_cooperacao', 'X'),
    fixed('f_tpo_acao_inov', 'X'),
    fixed('f_tematica', 'X'),
    ...['f_autores_l', 'f_inst_l', 'f_producoes_l', 'f_orientacoes_l'].map((n) => none(n)),
    // Os códigos ligados, como a página real os serve (34|39, 20/10/2026).
    ...(['f_producoes_d', 'f_orientacoes_d'] as const).map((name): Binding => ({
      kind: 'hidden',
      name,
      read: (el: XElement | undefined) =>
        el
          ? linkedCodes(
              el,
              name === 'f_producoes_d' ? 'f_producoes_l' : 'f_orientacoes_l',
              orientationLookup(state.root),
            )
          : '',
    })),
    {
      kind: 'select',
      name: 'f_tipo_privacidade',
      options: h.PRIVACY,
      read: (el) => state.privacy.get(el) ?? '1',
      write: (el, value) => state.privacy.set(el, value || '1'),
    },
    fixed('f_ctr', ids.f_ctr ?? 'U'),
    fixed('f_cod', state.code),
    fixed('f_codinst', ids.f_codinst ?? ''),
    fixed('f_seq_ativ', ids.f_seq_ativ ?? ''),
    fixed('f_seq_funcao', ids.f_seq_funcao ?? ''),
    fixed('f_seq_proj', ids.f_seq_proj ?? ''),
    fixed('f_cod_tipo', ids.f_cod_tipo ?? 'P'),
  ];
}

const inclusionPath = (state: LattesState, tipo: string) =>
  `PKG_PROJETO.form?f_tpo_cooperacao=X&amp;f_tpo_acao_inov=X&amp;f_tematica=X&amp;F_sta_inovacao=&amp;f_cod_tipo=${tipo}&amp;f_cod=${state.code}`;

/** O vínculo da atuação como preencherOpener() o copia para o formulário (inferido). */
function vinculoCopy(atuacao: XElement) {
  const v = childElements(atuacao, 'VINCULOS')[0];
  const val = (attrName: string) => (v ? (getAttr(v, attrName) ?? '') : '');
  return {
    anoFim: val('ANO-FIM'),
    anoInic: val('ANO-INICIO'),
    carga: val('CARGA-HORARIA-SEMANAL'),
    enqua: val('OUTRO-ENQUADRAMENTO-FUNCIONAL-INFORMADO'),
    regime: val('FLAG-DEDICACAO-EXCLUSIVA') === 'SIM' ? '3' : '',
    // O código do formulário, invertido em relação à exportação como o
    // f_stavinc do vínculo (observado em 15/10/2026); que preencherOpener leve
    // esse mesmo código é inferido. Literal, separado de vinculo-flag.ts.
    stavinc: { NAO: '1', SIM: '0' }[val('FLAG-VINCULO-EMPREGATICIO')] ?? '',
    vinc: val('OUTRO-VINCULO-INFORMADO') || val('TIPO-DE-VINCULO'),
  };
}

/**
 * O órgão da participação na página de alteração, como a real (18/10/2026):
 * os ocultos vêm vazios e só o f_orgao, desabilitado, mostra o texto que a
 * janela gravou, "órgão/\nunidade".
 */
function organText(participacao: XElement): string {
  const organ = getAttr(participacao, 'NOME-ORGAO') ?? '';
  const unit = getAttr(participacao, 'NOME-UNIDADE') ?? '';
  return unit ? `${organ}/\n${unit}` : organ;
}

/** O contrário de organFields: o órgão escolhido na janela, como a exportação o mostraria (inferido). */
function organOf(atuacao: XElement, code: string): Record<string, string> {
  const organs = ORGANS[getAttr(atuacao, 'CODIGO-INSTITUICAO') ?? ''] ?? [];
  const top = organs.find((o) => o.code === code);
  if (top) {
    return {
      'CODIGO-ORGAO': top.code,
      'CODIGO-UNIDADE': '',
      'NOME-ORGAO': top.name,
      'NOME-UNIDADE': '',
    };
  }
  for (const o of organs) {
    const unit = o.units.find(([c]) => c === code);
    if (unit) {
      return {
        'CODIGO-ORGAO': o.code,
        'CODIGO-UNIDADE': unit[0],
        'NOME-ORGAO': o.name,
        'NOME-UNIDADE': unit[1],
      };
    }
  }
  return { 'CODIGO-ORGAO': '', 'CODIGO-UNIDADE': '', 'NOME-ORGAO': '', 'NOME-UNIDADE': '' };
}

function rowIds(state: LattesState, p: Placed, tipo: string): Record<string, string> {
  const code = getAttr(p.atuacao, 'CODIGO-INSTITUICAO') ?? '';
  const lettered = code ? withLetter(state, code) : '';
  const name = getAttr(p.atuacao, 'NOME-INSTITUICAO') ?? '';
  const v = vinculoCopy(p.atuacao);
  return {
    f_carga: v.carga,
    // seleciona() grava o código sem a letra: em f_cod_inst com V, senão em f_cod_inst2.
    f_cod_inst: lettered.startsWith('V') ? code : '',
    f_cod_inst2: lettered && !lettered.startsWith('V') ? code : '',
    f_cod_tipo: tipo,
    f_codinst: lettered,
    f_enqua: v.enqua,
    f_inst_old: name,
    f_instold: name,
    f_orgao: organText(p.participacao),
    f_regime: v.regime,
    f_seq_ativ: getAttr(p.atuacao, 'SEQUENCIA-ATIVIDADE') ?? '',
    f_seq_funcao: getAttr(p.participacao, 'SEQUENCIA-FUNCAO-ATIVIDADE') ?? '',
    f_seq_proj: getAttr(p.projeto, 'SEQUENCIA-PROJETO') ?? '',
    f_stavinc: v.stavinc,
    f_vinc: v.vinc,
    inst: getAttr(p.atuacao, 'NOME-INSTITUICAO') ?? '',
  };
}

function lista(req: SimRequest, state: LattesState): SimResponse {
  const tipo = (req.get('f_cod_tipo') ?? 'P').toUpperCase();
  const rows = projetos(state)
    .filter((p) => NATURE[getAttr(p.projeto, 'NATUREZA') ?? ''] === tipo)
    .map((p) => {
      const ids = rowIds(state, p, tipo);
      const path = `PKG_PROJETO.form?f_cod=${state.code}&amp;f_cod_tipo=${tipo}&amp;f_codinst=${ids.f_codinst}&amp;f_seq_ativ=${ids.f_seq_ativ}&amp;f_seq_funcao=${ids.f_seq_funcao}&amp;f_seq_proj=${ids.f_seq_proj}`;
      return `<tr><td><a href="#" onclick="self.parent.modalCV2.setarUrl('${path}',true); return false;">${h.esc(getAttr(p.projeto, 'NOME-DO-PROJETO') ?? '')}</a></td></tr>`;
    })
    .join('\n');
  const novo = `<a href="#" onclick="self.parent.modalCV2.setarUrl('${inclusionPath(state, tipo)}',true); return false;">Incluir novo item</a>`;
  return html(h.page('Projetos', `<table>${rows}</table>\n<p>${novo}</p>`));
}

function form(req: SimRequest, state: LattesState): SimResponse {
  const seq = req.get('f_seq_proj');
  const tipo = (req.get('f_cod_tipo') ?? 'P').toUpperCase();
  const placed = seq ? bySeq(state, seq) : undefined;
  if (seq && !placed) return html(h.page('Projeto', '<p>Registro não encontrado.</p>'));
  const ids: Record<string, string> = placed
    ? { ...rowIds(state, placed, tipo), f_ctr: 'U' }
    : { f_cod_tipo: tipo, f_ctr: 'I' };
  const body = `<form name="GN_PROJETO" method="post" action="PKG_PROJETO.FORM">
${renderFields(bindings(state, ids), placed?.projeto)}
<p><a href="#" onclick="self.parent.modalCV3.setarUrl('PKG_PROJETO.pp_lista_inst?f_pgm=INSTVINCULO&amp;f_cod=${state.code}',true); return false;">Instituição</a></p>
${h.formButtons(Boolean(placed))}
</form>
${placed ? projectGridScripts(placed.projeto, orientationLookup(state.root)) : ''}
${h.formScripts('GN_PROJETO', placed ? 'Deseja realmente excluir esta produção?' : undefined)}`;
  return html(h.page('Projeto', body));
}

function nextAttr(state: LattesState, name: string, attrName: string): string {
  let max = 0;
  walk(state.root, (el) => {
    if (el.name === name) max = Math.max(max, Number(getAttr(el, attrName)) || 0);
  });
  return String(max + 1);
}

function post(req: SimRequest, state: LattesState): SimResponse {
  const ctr = req.get('f_ctr');
  const tipo = req.get('f_cod_tipo') ?? 'P';
  const back = h.savedScript(`pkg_projeto.lista?f_cod_tipo=${tipo}&f_cod=${state.code}`);
  // O banco do Lattes lê f_instituicoes como XML (configurarInstituicoes do
  // check()); vazio, a gravação para com ORA-19032 (observado em 28/10/2026).
  if ((ctr === 'I' || ctr === 'U') && !(req.get('f_instituicoes') ?? '').startsWith('<root>')) {
    return html(
      h.page(
        'Erro',
        '<p>Erro. ORA-19032: Era esperado o identificador de XML ,, foi recebido no content</p>',
      ),
    );
  }
  if (ctr === 'I') {
    const code = (req.get('f_cod_inst') || req.get('f_cod_inst2') || '').replace(/^[A-Za-z]/, '');
    const container = state.find(['DADOS-GERAIS', 'ATUACOES-PROFISSIONAIS']);
    const atuacao =
      code && container
        ? childElements(container, 'ATUACAO-PROFISSIONAL').find(
            (a) => getAttr(a, 'CODIGO-INSTITUICAO') === code,
          )
        : undefined;
    if (!atuacao) return html('<script>alert("Escolha a instituição do projeto.");</script>');
    const projeto = element('PROJETO-DE-PESQUISA', {
      'SEQUENCIA-PROJETO': nextAttr(state, 'PROJETO-DE-PESQUISA', 'SEQUENCIA-PROJETO'),
    });
    applyFields(bindings(state, {}), projeto, req);
    const participacao = element(
      'PARTICIPACAO-EM-PROJETO',
      {
        'ANO-FIM': req.get('F_ANO_FIM') ?? '',
        'ANO-INICIO': req.get('F_ANO_INIC') ?? '',
        'SEQUENCIA-FUNCAO-ATIVIDADE': nextAttr(
          state,
          'PARTICIPACAO-EM-PROJETO',
          'SEQUENCIA-FUNCAO-ATIVIDADE',
        ),
      },
      [projeto],
    );
    const atividades = state.ensure(atuacao, 'ATIVIDADES-DE-PARTICIPACAO-EM-PROJETO');
    insertInSchemaOrder(lattesSchema, atividades, participacao);
    // A equipe, os financiadores, as ligações e o órgão, como na alteração (inferido).
    applyProjectTeam(state, projeto, req);
    applyProjectLinks(state, projeto, req);
    const organ = req.get('f_codorgao') || req.get('f_codorgao2') || '';
    if (organ) {
      for (const [name, value] of Object.entries(organOf(atuacao, organ))) {
        setAttr(participacao, name, value);
      }
    }
    state.touch();
    return html(back);
  }
  const placed = bySeq(state, req.get('f_seq_proj'));
  if (!placed) return html(h.page('Projeto', '<p>Registro não encontrado.</p>'));
  // Como o Lattes real (18/10/2026): sem o XML das instituições, recusa a alteração.
  if (ctr === 'U' && !(req.get('f_instituicoes') ?? '').startsWith('<root>')) {
    return html(h.page('Projeto', '<p>Erro. ORA-19032: Era esperado o identificador de XML</p>'));
  }
  if (ctr === 'E') {
    const atividades = childElements(placed.atuacao, 'ATIVIDADES-DE-PARTICIPACAO-EM-PROJETO')[0]!;
    state.remove(atividades, placed.participacao);
  } else if (ctr === 'U') {
    applyFields(bindings(state, {}), placed.projeto, req);
    applyProjectTeam(state, placed.projeto, req);
    applyProjectLinks(state, placed.projeto, req);
    // Código vazio deixa o órgão como está, como na página real.
    const organ = req.get('f_codorgao') || req.get('f_codorgao2') || '';
    if (organ) {
      for (const [name, value] of Object.entries(organOf(placed.atuacao, organ))) {
        setAttr(placed.participacao, name, value);
      }
    }
  } else return html(back);
  state.touch();
  return html(back);
}

/**
 * As instituições das atuações, com o vínculo de cada uma (seção 17). Com
 * f_pgm=INSTVINCULO, a escolha chama preencherOpener() com os dados do
 * vínculo e seleciona() com o código e o nome; os valores de cada argumento
 * são inferidos dos nomes dos ocultos que eles preenchem.
 */
function listaInst(req: SimRequest, state: LattesState): SimResponse {
  if (req.method === 'POST' && req.get('F_PGM')?.toUpperCase() === 'INSTFINANC') {
    return funderSearch(req, state);
  }
  const container = state.find(['DADOS-GERAIS', 'ATUACOES-PROFISSIONAIS']);
  const atuacoes = container ? childElements(container, 'ATUACAO-PROFISSIONAL') : [];
  const vinculo = req.get('f_pgm')?.toUpperCase() === 'INSTVINCULO';
  const rows = atuacoes
    .filter((a) => getAttr(a, 'CODIGO-INSTITUICAO'))
    .map((a) => {
      const code = withLetter(state, getAttr(a, 'CODIGO-INSTITUICAO')!);
      const name = getAttr(a, 'NOME-INSTITUICAO') ?? '';
      // Em 28/10/2026 as linhas da janela das atuações chamavam só
      // seleciona(código, nome, sigla), sem o preencherOpener do vínculo de
      // 27/10. As aspas vão como estão (seção 18).
      const sigla = vinculo ? `,'${h.jsString(name.slice(0, 4).toUpperCase())}'` : '';
      return `<a href="javascript:seleciona('${code}','${h.jsString(name)}'${sigla})">${h.esc(name.toUpperCase())}</a><br>`;
    })
    .join('\n');
  return html(h.page('Instituições', rows));
}

/**
 * A busca de instituições do financiador (POST a PKG_PROJETO.PP_LISTA_INST
 * com F_PGM INSTFINANC e f_nome, lida em 27/10/2026): um seleciona() com o
 * código com a letra, o nome e a sigla por instituição que contém o texto.
 */
function funderSearch(req: SimRequest, state: LattesState): SimResponse {
  const query = foldText((req.get('f_nome') ?? '').trim());
  const links = institutionsOf(state)
    .filter((i) => query.length > 1 && foldText(i.name).includes(query))
    .map(
      (i) =>
        `<a href="#" onclick="seleciona('${i.code}','${h.jsString(i.name)}','${i.uf}'); return false;">${h.esc(i.name)}</a><br>`,
    )
    .join('\n');
  return html(h.page('Instituições', links));
}

/**
 * A janela de órgãos: no topo, os órgãos da instituição; aberta num órgão
 * (f_cod_inst2 com a letra), ele mesmo e as unidades, com o nome dele no
 * quarto argumento do atribuir(), como a página real.
 */
function organs(req: SimRequest, state: LattesState): SimResponse {
  const inst = (req.get('f_cod_inst') ?? '').slice(1);
  const parent = (req.get('f_cod_inst2') ?? '').slice(1);
  const all = ORGANS[inst] ?? [];
  const call = (code: string, name: string, above?: string) =>
    `<a class="selecionaOrg" href="" onclick="atribuir('${code}','${h.jsString(name)}'\n,0${above ? `,'${h.jsString(above)}'` : ''});return false;">${h.esc(name)}</a><br>`;
  const expand = (code: string) =>
    `<a title="Expandir itens" href="pkg_projeto.pp_orgao_cargo?f_origem=&f_modal_cv=2&f_cod=${state.code}&f_cod_inst=V${inst}&f_cod_inst2=V${code}">+</a>`;
  const top = all.find((o) => o.code === parent);
  const links = parent
    ? top
      ? [call(top.code, top.name), ...top.units.map(([c, n]) => expand(c) + call(c, n, top.name))]
      : []
    : all.map((o) => expand(o.code) + call(o.code, o.name));
  return html(
    h.page(
      'Órgãos',
      `<form action="pkg_projeto.pp_orgao_cargo" name="ORGAO" method=GET>
<script>function atribuir(cod,texto,tipo,texto2){ alert(cod); }</script>
${links.join('\n')}
${h.hidden('f_cod', state.code)}${h.hidden('f_cod_inst', req.get('f_cod_inst') ?? '')}${h.hidden('f_cod_inst2', '')}
</form>`,
    ),
  );
}

export const PROJETO_ROUTES: Routes = {
  'pkg_projeto.form': (req, state) => (req.method === 'POST' ? post(req, state) : form(req, state)),
  'pkg_projeto.lista': lista,
  'pkg_projeto.pp_lista_inst': listaInst,
  'pkg_projeto.pp_orgao_cargo': organs,
  // A janela de órgãos das atividades da atuação: as mesmas linhas (lida em 20/10/2026).
  prc_orgao_cargo: organs,
};
