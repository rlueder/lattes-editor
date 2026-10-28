// As linhas de pesquisa no Lattes simulado: a lista pkg_linhapesq.lista e o
// formulário GN_LINHA, postado para PKG_LINHAPESQ.FORM. Lidos no Lattes real
// em 19/10/2026 (production/targets/demais.ts): a lista traz cada linha com
// F_SEQ_ATIV, F_SEQ_FUNCAO, F_SEQ_LINHA e F_CODINST, e o formulário tem o
// título, os objetivos (f_ref), se está ativa (f_status S ou N), os mesmos em
// inglês e as grades de palavras-chave, áreas e setores. A linha não tem
// inclusão própria: entra pela grade da atividade (atividades.ts). O f_ctr U e
// a ordem dos campos são inferidos.

import { childElements, getAttr, type XElement } from '../../src/model/xml.ts';
import { withLetter } from './buscas.ts';
import { applyFields, attr, type Binding, fixed, mapped, renderFields } from './campos.ts';
import type { LattesState } from './estado.ts';
import { applyFormationGrids, gridScripts } from './grades.ts';
import * as h from './html.ts';
import type { SimRequest } from './pedido.ts';
import { html, type Routes, type SimResponse } from './tipos.ts';

interface Found {
  activity: XElement;
  atuacao: XElement;
  linha: XElement;
}

/** Cada linha de pesquisa das atividades de pesquisa e desenvolvimento. */
function linhas(state: LattesState): Found[] {
  const out: Found[] = [];
  const atuacoes = state.find(['DADOS-GERAIS', 'ATUACOES-PROFISSIONAIS']);
  for (const atuacao of atuacoes ? childElements(atuacoes, 'ATUACAO-PROFISSIONAL') : []) {
    for (const box of childElements(atuacao, 'ATIVIDADES-DE-PESQUISA-E-DESENVOLVIMENTO')) {
      for (const activity of childElements(box, 'PESQUISA-E-DESENVOLVIMENTO')) {
        for (const linha of childElements(activity, 'LINHA-DE-PESQUISA')) {
          out.push({ activity, atuacao, linha });
        }
      }
    }
  }
  return out;
}

const ids = (f: Found) => ({
  ativ: getAttr(f.atuacao, 'SEQUENCIA-ATIVIDADE') ?? '',
  funcao: getAttr(f.activity, 'SEQUENCIA-FUNCAO-ATIVIDADE') ?? '',
  linha: getAttr(f.linha, 'SEQUENCIA-LINHA') ?? '',
});

function byRequest(req: SimRequest, state: LattesState): Found | undefined {
  const get = (n: string) => req.get(n) ?? req.get(n.toLowerCase()) ?? '';
  return linhas(state).find((f) => {
    const i = ids(f);
    return (
      i.ativ === get('F_SEQ_ATIV') &&
      i.funcao === get('F_SEQ_FUNCAO') &&
      i.linha === (get('F_SEQ_LINHA') || get('f_seq_linha'))
    );
  });
}

function bindings(state: LattesState, f: Found): Binding[] {
  const i = ids(f);
  return [
    attr('f_titulo', 'TITULO-DA-LINHA-DE-PESQUISA', 'text', { maxLength: 255 }),
    mapped(
      'f_status',
      'FLAG-LINHA-DE-PESQUISA-ATIVA',
      'radio',
      { NAO: 'N', SIM: 'S' },
      {
        options: [
          ['S', 'Sim'],
          ['N', 'Não'],
        ],
      },
    ),
    attr('f_ref', 'OBJETIVOS-LINHA-DE-PESQUISA', 'textarea'),
    attr('f_titulo_en', 'TITULO-DA-LINHA-DE-PESQUISA-INGLES', 'text', { maxLength: 255 }),
    attr('f_ref_en', 'OBJETIVOS-LINHA-DE-PESQUISA-INGLES', 'textarea'),
    fixed('f_ctr', 'U'),
    fixed('f_cod', state.code),
    fixed('F_SEQ_ATIV', i.ativ),
    fixed('F_SEQ_FUNCAO', i.funcao),
    fixed('f_seq_linha', i.linha),
    fixed('F_CODINST', withLetter(state, getAttr(f.atuacao, 'CODIGO-INSTITUICAO') ?? '')),
  ];
}

function lista(state: LattesState): SimResponse {
  const rows = linhas(state)
    .map((f) => {
      const i = ids(f);
      const inst = withLetter(state, getAttr(f.atuacao, 'CODIGO-INSTITUICAO') ?? '');
      return `<tr><td><a href="#" onclick="self.parent.modalCV2.setarUrl('pkg_linhapesq.form?f_cod=${state.code}&amp;F_SEQ_ATIV=${i.ativ}&amp;F_SEQ_FUNCAO=${i.funcao}&amp;F_SEQ_LINHA=${i.linha}&amp;F_CODINST=${inst}',true); return false;">${h.esc(getAttr(f.linha, 'TITULO-DA-LINHA-DE-PESQUISA') ?? '')}</a></td></tr>`;
    })
    .join('\n');
  return html(h.page('Atuação profissional - Linhas de pesquisa', `<table>${rows}</table>`));
}

function form(req: SimRequest, state: LattesState): SimResponse {
  const found = byRequest(req, state);
  if (!found) return html(h.page('Linha de pesquisa', '<p>Registro não encontrado.</p>'));
  const body = `<form name="GN_LINHA" method="post" action="PKG_LINHAPESQ.FORM">
${renderFields(bindings(state, found), found.linha)}
${h.hidden('f_plv_l', '')}${h.hidden('f_setor_l', '')}${h.hidden('f_area_l', '')}
${h.formButtons(false)}
</form>
${gridScripts(found.linha)}`;
  return html(h.page('Linha de pesquisa', body));
}

function post(req: SimRequest, state: LattesState): SimResponse {
  const found = byRequest(req, state);
  if (!found) return html(h.page('Linha de pesquisa', '<p>Registro não encontrado.</p>'));
  // O check() exige o campo Ativa (seção 22).
  if (!req.get('f_status'))
    return html('<script>alert("Informe se a linha está ativa.");</script>');
  applyFields(bindings(state, found), found.linha, req);
  applyFormationGrids(found.linha, req);
  state.touch();
  return html(h.savedScript(`pkg_linhapesq.lista?f_cod=${state.code}`));
}

export const LINHAS_ROUTES: Routes = {
  'pkg_linhapesq.form': (req, state) =>
    req.method === 'POST' ? post(req, state) : form(req, state),
  'pkg_linhapesq.lista': (_req, state) => lista(state),
};
