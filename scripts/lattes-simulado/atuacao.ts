// Atuação profissional no Lattes simulado: a lista de atuações, a grade de
// cargos e vínculos de cada uma, o formulário do vínculo (GN_ATIV_VINC), a
// inclusão de atuação (GN_ATIV) e a busca de instituição (PRC_INST_FORM).
// Formulários e links como em docs/lattes_internals.md, seções 3, 5, 11, 15 e
// 18, e no reconhecimento de 10/10/2026, seção 4.1.

import { insertInSchemaOrder } from '../../src/model/schema-order.ts';
import { childElements, element, getAttr, setAttr, type XElement } from '../../src/model/xml.ts';
import { lattesSchema } from '../../src/schema/lattes.ts';
import { cargoForm, cargoPost, teaching } from './atividades.ts';
import { applyFields, attr, type Binding, fixed, mapped, renderFields } from './campos.ts';
import type { LattesState } from './estado.ts';
import * as h from './html.ts';
import type { SimRequest } from './pedido.ts';
import { html, type Routes, type SimResponse } from './tipos.ts';

/** Texto do combo dominio() para cada TIPO-DE-VINCULO (inferido dos rótulos). */
const VINCULO_TEXT: Record<string, string> = {
  CELETISTA: 'Celetista',
  PROFESSOR_VISITANTE: 'Professor Visitante',
  SERVIDOR_PUBLICO: 'Servidor público',
};
const VINCULO_CODE = Object.fromEntries(Object.entries(VINCULO_TEXT).map(([c, t]) => [t, c]));

/** f_codinst da lista: o código do XML com uma letra na frente (seção 3). */
const linkInst = (code: string) => (!code ? '' : /^[A-Z]/.test(code) ? code : `D${code}`);

function atuacoes(state: LattesState): XElement[] {
  const container = state.find(['DADOS-GERAIS', 'ATUACOES-PROFISSIONAIS']);
  return container ? childElements(container, 'ATUACAO-PROFISSIONAL') : [];
}

const findAtuacao = (state: LattesState, seq: string | undefined) =>
  atuacoes(state).find((a) => getAttr(a, 'SEQUENCIA-ATIVIDADE') === seq);

/** Os campos do vínculo comuns à alteração (GN_ATIV_VINC) e à inclusão (GN_ATIV). */
function vinculoFields(state: LattesState, disabledVinc: boolean): Binding[] {
  return [
    {
      disabled: disabledVinc,
      kind: 'text',
      maxLength: 30,
      name: 'f_vinc',
      read: (el) =>
        VINCULO_TEXT[getAttr(el, 'TIPO-DE-VINCULO') ?? ''] ??
        getAttr(el, 'OUTRO-VINCULO-INFORMADO') ??
        '',
    },
    // Invertido como no Lattes (observado em 15/10/2026): o formulário diz
    // Sim (1) e a exportação grava NAO; Não (0) vira SIM. O mapa é literal,
    // de propósito separado de src/bridge/vinculo-flag.ts, para que os testes
    // de ponta a ponta confiram o conector contra uma fonte independente.
    mapped(
      'f_stavinc',
      'FLAG-VINCULO-EMPREGATICIO',
      'select',
      { NAO: '1', SIM: '0' },
      {
        options: [
          ['', ''],
          ['0', 'Não'],
          ['1', 'Sim'],
        ],
      },
    ),
    attr('f_enqua', 'OUTRO-ENQUADRAMENTO-FUNCIONAL-INFORMADO', 'text', { maxLength: 45 }),
    attr('f_carga', 'CARGA-HORARIA-SEMANAL', 'text', { maxLength: 3 }),
    {
      kind: 'checkbox',
      name: 'f_regime',
      read: (el) => (getAttr(el, 'FLAG-DEDICACAO-EXCLUSIVA') === 'SIM' ? '3' : ''),
      value: '3',
      write: (el, value) => setAttr(el, 'FLAG-DEDICACAO-EXCLUSIVA', value === '3' ? 'SIM' : 'NAO'),
    },
    attr('f_mes_ini', 'MES-INICIO', 'text', { maxLength: 2 }),
    attr('f_ano_ini', 'ANO-INICIO', 'text', { maxLength: 4 }),
    {
      // Atual quando não há ano de fim; o servidor guarda só as datas.
      kind: 'radio',
      name: 'f_status',
      options: h.capturedList('L29'),
      read: (el) => (getAttr(el, 'ANO-FIM') ? 'N' : 'S'),
    },
    attr('f_mes_fim', 'MES-FIM', 'text', { maxLength: 2 }),
    attr('f_ano_fim', 'ANO-FIM', 'text', { maxLength: 4 }),
    attr('f_outras_inf', 'OUTRAS-INFORMACOES', 'textarea', { maxLength: 3950 }),
    {
      kind: 'select',
      name: 'f_tipo_privacidade',
      options: h.PRIVACY,
      read: (el) => state.privacy.get(el) ?? '1',
      write: (el, value) => state.privacy.set(el, value || '1'),
    },
    {
      // check() copia o texto de f_vinc para cá antes de enviar; a página o traz vazio.
      kind: 'hidden',
      name: 'f_vinculo',
      read: () => '',
      write: (el, value) => {
        if (!value) return;
        const code = VINCULO_CODE[value];
        setAttr(el, 'TIPO-DE-VINCULO', code ?? 'OUTRO');
        setAttr(el, 'OUTRO-VINCULO-INFORMADO', code ? '' : value);
      },
    },
  ];
}

function vinculoBindings(state: LattesState, ids: Record<string, string>): Binding[] {
  const list = vinculoFields(state, true);
  // Os campos em inglês ficam logo depois dos seus pares, como no formulário.
  list.splice(
    3,
    0,
    attr('f_enqua_en', 'OUTRO-ENQUADRAMENTO-FUNCIONAL-INFORMADO-INGLES', 'text', {
      maxLength: 45,
    }),
  );
  list.splice(
    12,
    0,
    attr('f_outras_inf_en', 'OUTRAS-INFORMACOES-INGLES', 'textarea', { maxLength: 2000 }),
  );
  return [
    ...list,
    fixed('f_ctr', ids.f_ctr ?? 'U'),
    fixed('f_cod', state.code),
    fixed('f_codinst', ids.f_codinst ?? ''),
    fixed('f_seq_ativ', ids.f_seq_ativ ?? ''),
    fixed('f_seq_hist', ids.f_seq_hist ?? ''),
  ];
}

function lista(state: LattesState): SimResponse {
  const rows = atuacoes(state)
    .map((a) => {
      const path = `PKG_ATIV.cargos_vinculos?f_cod=${state.code}&amp;f_codinst=${linkInst(getAttr(a, 'CODIGO-INSTITUICAO') ?? '')}&amp;f_seq_ativ=${getAttr(a, 'SEQUENCIA-ATIVIDADE')}`;
      return `<tr><td><a href="#" onclick="self.parent.modalCV2.setarUrl('${path}',true); return false;">${h.esc(getAttr(a, 'NOME-INSTITUICAO') ?? '')}</a></td></tr>`;
    })
    .join('\n');
  const novo = `<a href="#" onclick="self.parent.modalCV2.setarUrl('PKG_ATIV.inclui?f_cod=${state.code}',true); return false;">Incluir novo item</a>`;
  return html(h.page('Atuação profissional', `<table>${rows}</table>\n<p>${novo}</p>`));
}

function cargosVinculos(req: SimRequest, state: LattesState): SimResponse {
  const a = findAtuacao(state, req.get('f_seq_ativ'));
  if (!a) return html(h.page('Atuação profissional', '<p>Registro não encontrado.</p>'));
  const seqAtiv = getAttr(a, 'SEQUENCIA-ATIVIDADE')!;
  const inst = linkInst(getAttr(a, 'CODIGO-INSTITUICAO') ?? '');
  const base = `PKG_ATIV.vinculos?f_cod=${state.code}&amp;f_codinst=${inst}&amp;f_seq_ativ=${seqAtiv}`;
  const rows = childElements(a, 'VINCULOS')
    .map((v) => {
      const seq = getAttr(v, 'SEQUENCIA-HISTORICO');
      return `<tr><td><a href="${base}&amp;f_seq_hist=${seq}">Vínculo ${seq}: ${getAttr(v, 'ANO-INICIO') ?? ''}</a></td></tr>`;
    })
    .join('\n');
  // dele(): a atuação inteira, por GET com f_ctr=E2 (seção 15).
  const dele = `<script>function dele(){ if (confirm('Esta operação apagará: Todas as atividades; Vínculos; Projetos; Linhas de pesquisa. Deseja continuar?') && confirm('Confirmar exclusão?')) location = 'pkg_ativ.form?f_cod=${state.code}&f_seq_ativ=${seqAtiv}&f_ctr=E2'; }</script>`;
  // selecionarNatureza() abre o combo de naturezas e o formulário pkg_ativ.cargo
  // (seção 17); o endereço com f_natur_ativ vazio é o que o censo leu na tela.
  // No atributo onclick o & vai como &amp;; dentro do <script>, literal.
  const cargoUrl = `pkg_ativ.cargo?f_cod=${state.code}&f_codinst=${inst}&f_seq_ativ=${seqAtiv}&f_natur_ativ=`;
  const cargo = cargoUrl.replaceAll('&', '&amp;');
  // As atividades de ensino, cada uma com f_seq_funcao (link inferido).
  const activities = teaching(a)
    .map(
      (e) =>
        `<tr><td><a href="#" onclick="self.parent.modalCV2.setarUrl('${cargo}4&amp;f_seq_funcao=${getAttr(e, 'SEQUENCIA-FUNCAO-ATIVIDADE')}',true); return false;">Ensino ${getAttr(e, 'ANO-INICIO') ?? ''}</a></td></tr>`,
    )
    .join('\n');
  const body = `<table>${rows}${activities}</table>
<p><a href="${base}">Incluir vínculo</a> <a href="#" onclick="selecionarNatureza(); return false;">Incluir atividade</a> <a href="#" onclick="dele(); return false;">Excluir atuação</a></p>${dele}
<script>function selecionarNatureza(){ self.parent.modalCV2.setarUrl('${cargoUrl}', true); }</script>`;
  return html(h.page(getAttr(a, 'NOME-INSTITUICAO') ?? 'Atuação', body));
}

function vinculoForm(req: SimRequest, state: LattesState): SimResponse {
  const a = findAtuacao(state, req.get('f_seq_ativ'));
  const seqHist = req.get('f_seq_hist');
  const v = seqHist
    ? a && childElements(a, 'VINCULOS').find((x) => getAttr(x, 'SEQUENCIA-HISTORICO') === seqHist)
    : undefined;
  if (!a || (seqHist && !v)) return html(h.page('Vínculo', '<p>Registro não encontrado.</p>'));
  const ids = {
    f_codinst: req.get('f_codinst') ?? '',
    f_ctr: v ? 'U' : 'I',
    f_seq_ativ: getAttr(a, 'SEQUENCIA-ATIVIDADE') ?? '',
    f_seq_hist: seqHist ?? '',
  };
  const body = `<form name="GN_ATIV_VINC" method="post" action="PKG_ATIV.VINCULOS">
${renderFields(vinculoBindings(state, ids), v)}
${h.formButtons(Boolean(v))}
</form>
${h.formScripts('GN_ATIV_VINC', v ? 'Deseja realmente excluir este vínculo?' : undefined)}`;
  return html(h.page('Vínculo', body));
}

function vinculoPost(req: SimRequest, state: LattesState): SimResponse {
  const a = findAtuacao(state, req.get('f_seq_ativ'));
  if (!a) return html(h.page('Vínculo', '<p>Registro não encontrado.</p>'));
  const back = h.savedScript(
    `PKG_ATIV.cargos_vinculos?f_cod=${state.code}&f_codinst=${req.get('f_codinst') ?? ''}&f_seq_ativ=${getAttr(a, 'SEQUENCIA-ATIVIDADE')}`,
  );
  const ctr = req.get('f_ctr');
  const bindings = vinculoBindings(state, {});
  if (ctr === 'I' && !req.get('f_seq_hist')) {
    const v = element('VINCULOS', {
      'SEQUENCIA-HISTORICO': state.nextSeq(a, 'VINCULOS', 'SEQUENCIA-HISTORICO'),
    });
    insertInSchemaOrder(lattesSchema, a, v);
    applyFields(bindings, v, req);
    state.touch();
    return html(back);
  }
  const v = childElements(a, 'VINCULOS').find(
    (x) => getAttr(x, 'SEQUENCIA-HISTORICO') === req.get('f_seq_hist'),
  );
  if (!v) return html(h.page('Vínculo', '<p>Registro não encontrado.</p>'));
  if (ctr === 'E') state.remove(a, v);
  else if (ctr === 'U') applyFields(bindings, v, req);
  else return html(back);
  state.touch();
  return html(back);
}

// ---------------------------------------------------------------- inclusão

function incluiBindings(state: LattesState): Binding[] {
  return [
    { kind: 'text', maxLength: 75, name: 'f_inst', read: () => '' },
    fixed('f_inst_old', ''),
    fixed('f_cod_inst', ''),
    fixed('f_cod_inst2', ''),
    ...vinculoFields(state, false),
    fixed('f_ctr', 'I'),
    fixed('f_cod', state.code),
  ];
}

function incluiForm(_req: SimRequest, state: LattesState): SimResponse {
  const body = `<form name="GN_ATIV" method="post" action="PKG_ATIV.INCLUI">
${renderFields(incluiBindings(state), undefined)}
<p><a href="#" onclick="self.parent.modalCV3.setarUrl('prc_inst_form?f_cod=${state.code}&amp;f_nivel=',true); return false;">Buscar instituição</a></p>
${h.formButtons(false)}
</form>${h.formScripts('GN_ATIV')}`;
  return html(h.page('Incluir atuação profissional', body));
}

function incluiPost(req: SimRequest, state: LattesState): SimResponse {
  if (req.get('f_ctr') !== 'I') return html(h.savedScript('pkg_ativ.lista'));
  const withLetter = req.get('f_cod_inst') || req.get('f_cod_inst2') || '';
  const name = req.get('f_inst') || req.get('f_inst_old') || '';
  if (!withLetter || !name) {
    return html('<script>alert("Informe a instituição.");</script>');
  }
  const container = state.ensurePath(['DADOS-GERAIS', 'ATUACOES-PROFISSIONAIS']);
  const seq = state.nextSeq(container, 'ATUACAO-PROFISSIONAL', 'SEQUENCIA-ATIVIDADE');
  // O XML guarda o código sem a letra da busca (seção 3).
  const a = element('ATUACAO-PROFISSIONAL', {
    'CODIGO-INSTITUICAO': withLetter.replace(/^[A-Za-z]/, ''),
    'NOME-INSTITUICAO': name,
    'SEQUENCIA-ATIVIDADE': seq,
    'SEQUENCIA-IMPORTANCIA': seq,
  });
  const v = element('VINCULOS', { 'SEQUENCIA-HISTORICO': '1' });
  applyFields(vinculoFields(state, false), v, req);
  insertInSchemaOrder(lattesSchema, a, v);
  insertInSchemaOrder(lattesSchema, container, a);
  state.touch();
  return html(h.savedScript(`pkg_ativ.lista?f_cod=${state.code}`));
}

/** A atuação inteira, por GET com f_ctr=E2: apaga tudo o que pende dela. */
function ativForm(req: SimRequest, state: LattesState): SimResponse {
  const a = findAtuacao(state, req.get('f_seq_ativ'));
  if (req.get('f_ctr') === 'E2' && a) {
    state.remove(state.find(['DADOS-GERAIS', 'ATUACOES-PROFISSIONAIS'])!, a);
    state.touch();
  }
  return lista(state);
}

export const ATUACAO_ROUTES: Routes = {
  'pkg_ativ.cargo': (req, state) => {
    const a = findAtuacao(state, req.get('f_seq_ativ'));
    return req.method === 'POST' ? cargoPost(req, state, a) : cargoForm(req, state, a);
  },
  'pkg_ativ.cargos_vinculos': cargosVinculos,
  'pkg_ativ.form': ativForm,
  'pkg_ativ.inclui': (req, state) =>
    req.method === 'POST' ? incluiPost(req, state) : incluiForm(req, state),
  'pkg_ativ.lista': (_req, state) => lista(state),
  'pkg_ativ.vinculos': (req, state) =>
    req.method === 'POST' ? vinculoPost(req, state) : vinculoForm(req, state),
};
