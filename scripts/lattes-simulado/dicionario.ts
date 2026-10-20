// O dicionário de coautores (pkg_dic_autor), como o real foi lido em
// 19/10/2026: a lista com uma linha por coautor (pp_autor(n), nome, nome em
// citações, produções e projetos), o formulário GN_AUTOR de cada um, a
// pergunta existe_prod_validada (S ou N) e a gravação, que troca a citação em
// todas as produções do coautor. O simulado monta as entradas dos autores e
// participantes de banca do currículo, menos a própria pessoa, na ordem em
// que aparecem; o número de cada uma é a posição dela.

import { foldText } from '../../src/model/fold-text.ts';
import { childElements, getAttr, setAttr, type XElement } from '../../src/model/xml.ts';
import type { LattesState } from './estado.ts';
import * as h from './html.ts';
import type { SimRequest } from './pedido.ts';
import { html, type Routes, type SimResponse } from './tipos.ts';

const PARTS = [
  { citation: 'NOME-PARA-CITACAO', element: 'AUTORES', name: 'NOME-COMPLETO-DO-AUTOR' },
  {
    citation: 'NOME-PARA-CITACAO-DO-PARTICIPANTE-DA-BANCA',
    element: 'PARTICIPANTE-BANCA',
    name: 'NOME-COMPLETO-DO-PARTICIPANTE-DA-BANCA',
  },
];

interface Entry {
  citation: string;
  name: string;
  uses: { attr: string; el: XElement }[];
}

function entries(state: LattesState): Entry[] {
  const out: Entry[] = [];
  const own = foldText(state.personName);
  const walk = (el: XElement) => {
    const part = PARTS.find((p) => p.element === el.name);
    if (part) {
      const name = getAttr(el, part.name) ?? '';
      const citation = getAttr(el, part.citation) ?? '';
      if (name && foldText(name) !== own) {
        let entry = out.find((e) => foldText(e.name) === foldText(name) && e.citation === citation);
        if (!entry) out.push((entry = { citation, name, uses: [] }));
        entry.uses.push({ attr: part.citation, el });
      }
    }
    for (const c of childElements(el)) walk(c);
  };
  walk(state.root);
  return out;
}

function lista(state: LattesState): SimResponse {
  const rows = entries(state)
    .map(
      (e, i) =>
        `<tr onclick="pp_autor(${i + 1})"><td>&nbsp;&nbsp;&nbsp;${h.esc(e.name)}</td><td>${h.esc(e.citation)}</td><td>${e.uses.length}</td><td><font color=red>0</font></td><td>&nbsp;</td></tr>`,
    )
    .join('\n');
  return html(
    h.page(
      'Coautores',
      `<script>function pp_autor(arg){ self.parent.modalCV2.setarUrl("pkg_dic_autor.form?f_cod=${state.code}&f_seq=" + arg,true); }</script>
<form name="GN_AUTOR" action="PKG_DIC_AUTOR.DEL">${h.hidden('f_cod', state.code)}</form>
<table id="lista"><tbody>${rows}</tbody></table>`,
    ),
  );
}

function entryOf(req: SimRequest, state: LattesState) {
  const seq = Number(req.get('f_seq'));
  return { entry: entries(state)[seq - 1], seq: String(seq) };
}

function form(req: SimRequest, state: LattesState): SimResponse {
  if (req.method === 'POST') return gravar(req, state);
  const { entry, seq } = entryOf(req, state);
  if (!entry) return html('<p>Coautor não encontrado</p>', 404);
  return html(
    h.page(
      'Coautor',
      `<script>var nmeCitCad = "${h.jsString(entry.citation)}";</script>
<form action="PKG_DIC_AUTOR.FORM" name="GN_AUTOR">
${h.text('f_nome', entry.name)}
${h.text('f_nome_cit', entry.citation)}
${h.hidden('f_cod', state.code)}${h.hidden('f_seq', seq)}${h.hidden('f_tipo', 'A')}${h.hidden('f_ctr', 'U')}${h.hidden('f_id', '')}${h.hidden('f_sta_old', '')}
<input type="checkbox" name="f_chk">
</form>`,
    ),
  );
}

function gravar(req: SimRequest, state: LattesState): SimResponse {
  const { entry } = entryOf(req, state);
  const citation = req.get('f_nome_cit')?.trim() ?? '';
  if (!entry || req.get('f_ctr') !== 'U' || !citation) return html('<p>Erro</p>', 400);
  for (const u of entry.uses) setAttr(u.el, u.attr, citation);
  return lista(state);
}

function validada(req: SimRequest, state: LattesState): SimResponse {
  const { entry } = entryOf(req, state);
  return {
    contentType: 'text/plain',
    html: entry && state.validatedCoauthors.has(entry.name) ? 'S' : 'N',
  };
}

export const DICIONARIO_ROUTES: Routes = {
  'pkg_dic_autor.existe_prod_validada': validada,
  'pkg_dic_autor.form': form,
  'pkg_dic_autor.lista': (_req, state) => lista(state),
};
