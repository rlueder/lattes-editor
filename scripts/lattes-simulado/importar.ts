// Importar no Lattes simulado: os passos 1 a 3 de pkg_importa_xml
// (docs/lattes_internals.md, seção 13), com o que os testes acompanhados de
// 13 e 14/10/2026 mostraram. As regras exatas de recusa do passo 1 e de
// descarte no passo 3 não foram isoladas no Lattes; aqui elas são palpites
// declarados, ajustáveis quando o próximo teste disser mais.

import { itemYear } from '../../src/import-export/import-file.ts';
import { IMPORT_MODULES } from '../../src/import-export/importable.ts';
import { decodeLatin1 } from '../../src/model/latin1.ts';
import { addProduction, importableTypes, type ProductionType } from '../../src/model/production.ts';
import {
  childElements,
  getAttr,
  parseXml,
  setAttr,
  walk,
  type XElement,
} from '../../src/model/xml.ts';
import { lattesSchema } from '../../src/schema/lattes.ts';
import type { ImportItem, LattesState } from './estado.ts';
import * as h from './html.ts';
import type { SimRequest } from './pedido.ts';
import { html, type Routes, type SimResponse } from './tipos.ts';

export const DTD_ALERT =
  'Erro. Não foi possível processar o arquivo enviado. Certifique-se que o mesmo esteja de acordo com o DTD do Curriculo Lattes.';
export const NO_PRODUCTION_ALERT =
  'O arquivo enviado para importação não contém produções científicas.';
export const SENT_ALERT = 'O arquivo foi enviado com sucesso!';
export const DONE_MESSAGE = 'A operação foi realizada com sucesso!';
export const PENDING_NOTICE = 'Existe solicitação de Importação de XML pendente';

const TYPES = importableTypes(lattesSchema);
/** Número da caixa f_chkp de cada módulo, na ordem da tela (1 a 17). */
const MODULE_NUMBER = new Map(IMPORT_MODULES.map((m, i) => [m.id, i + 1]));
const EVENTS_MODULE = MODULE_NUMBER.get('eventos')!;

const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

/** O título do item, como o passo 3 compara (pelo título, observado). */
export function itemTitle(item: XElement): string {
  for (const c of childElements(item)) {
    if (!c.name.startsWith('DADOS-BASICOS')) continue;
    const a = c.attrs.find((x) => x.name.startsWith('TITULO') && !x.name.endsWith('INGLES'));
    if (a?.value.trim()) return a.value.trim();
  }
  return '';
}

/** Os itens de produção de um currículo, com o módulo de cada um. */
function productionItems(root: XElement): { el: XElement; module: number; type: ProductionType }[] {
  const out: { el: XElement; module: number; type: ProductionType }[] = [];
  walk(root, (el, ancestors) => {
    const path = ancestors
      .slice(1)
      .map((a) => a.name)
      .join('/');
    const type = TYPES.find((t) => t.itemName === el.name && t.containerPath.join('/') === path);
    if (type) out.push({ el, module: MODULE_NUMBER.get(type.module.id)!, type });
  });
  return out;
}

function step1(state: LattesState, alertText?: string): string {
  const alert = alertText ? `<script>alert("${h.jsString(alertText)}");</script>` : '';
  return h.page(
    'Importar currículo',
    `${alert}<form name="fl" method="post" action="pkg_importa_xml.inicio" enctype="multipart/form-data">
<input type="file" name="file" accept=".xml">
${h.hidden('f_cod', state.code)}${h.hidden('f_ctr', 'I')}${h.hidden('f_ret', '')}
<input type="button" value="Enviar" onclick="check()">
</form>
<script>var dc = document.forms['fl']; function check(){ if (!/\\.xml$/i.test(dc.file.value)) { alert('Escolha um arquivo .xml'); return; } dc.submit(); }</script>`,
  );
}

function step2(state: LattesState, notice: string): string {
  const req = state.importRequest!;
  const years = [...new Set(req.items.map((i) => i.year).filter((y): y is number => !!y))].sort(
    (a, b) => b - a,
  );
  if (!years.length) years.push(new Date().getFullYear());
  const boxes = IMPORT_MODULES.map(
    (m, i) => `<label>${h.checkbox('f_chkp', String(i + 1), true)} ${h.esc(m.label)}</label><br>`,
  ).join('\n');
  const yearOptions: [string, string][] = years.map((y) => [String(y), String(y)]);
  return h.page(
    'Importar currículo',
    `${notice}<form name="pkg_imp_xml" method="post" action="pkg_importa_xml.mostra_modulos">
${h.hidden('f_cod', state.code)}${h.hidden('f_solic', req.id)}${h.hidden('f_chkp', 'dummy')}${h.hidden('f_ctr', '')}
<label>${h.checkbox('f_all', 'S', true)} Selecionar todos</label><br>
${boxes}
<p>Produção C&amp;T a partir de ${h.select('f_ano_prod', yearOptions, yearOptions[0]![0])}</p>
<p><a href="#" onclick="enviar(); return false;">Confirmar</a> <a href="#" onclick="excluir(); return false;">Descartar</a></p>
</form>
<script>var dc = document.forms['pkg_imp_xml'];
function enviar(){ dc.f_ctr.value = 'I'; dc.submit(); }
function excluir(){ if (confirm('Deseja descartar a importação?')) { dc.f_ctr.value = 'D'; dc.submit(); } }</script>`,
  );
}

/** Os itens que o passo 3 mostra: dos módulos escolhidos, do ano escolhido em diante. */
function listed(state: LattesState): ImportItem[] {
  const req = state.importRequest!;
  const chosen = req.chosen!;
  return req.items.filter(
    (i) => chosen.modules.includes(i.module) && (i.year === undefined || i.year >= chosen.year),
  );
}

function step3(state: LattesState): string {
  const req = state.importRequest!;
  const inCv = new Set(
    productionItems(state.root)
      .map((p) => fold(itemTitle(p.el)))
      .filter(Boolean),
  );
  const rows = listed(state)
    .map((i) => {
      // Verde: não está no currículo. A comparação é pelo título; sem título,
      // "Produção sem título", sempre verde (observado em 14/10/2026).
      const green = !i.title || !inCv.has(fold(i.title));
      return `<tr><td>${h.checkbox('f_sq', i.id, true)}</td><td><b class="quadrado ${green ? 'verde' : 'vermelho'}"></b></td><td>${h.esc(i.title || 'Produção sem título')}${i.year ? `, ${i.year}` : ''}</td></tr>`;
    })
    .join('\n');
  const chosen = req.chosen!.modules.map((m) => h.hidden('f_chkp', String(m))).join('');
  return h.page(
    'Importar currículo',
    `<form name="pkg_imp_xml" method="post" action="pkg_importa_xml.mostra_lista_prod">
${h.hidden('f_cod', state.code)}${h.hidden('f_solic', req.id)}${h.hidden('f_sq', 'dummy')}${h.hidden('f_ctr', '')}${h.hidden('f_chkp', 'dummy')}${chosen}
<label>${h.checkbox('f_all', 'S', true)} Selecionar todos</label>
<table>${rows}</table>
<p><a href="#" onclick="enviar(); return false;">Confirmar</a> <a href="#" onclick="excluir(); return false;">Descartar</a></p>
</form>
<script>var dc = document.forms['pkg_imp_xml'];
function enviar(){ var ok = false; for (var i = 0; i < dc.elements.length; i++) { var e = dc.elements[i]; if (e.name == 'f_sq' && e.type == 'checkbox' && e.checked) ok = true; } if (!ok) { alert('Selecione ao menos uma produção.'); return; } dc.f_ctr.value = 'I'; dc.submit(); }
function excluir(){ if (confirm('Deseja descartar a importação?')) { dc.f_ctr.value = 'D'; dc.submit(); } }</script>`,
  );
}

/**
 * Passo 1. Recusa (inferido, a regra exata não foi isolada): o DADOS-GERAIS
 * do arquivo sem algum atributo que o currículo tem (o arquivo com só os
 * atributos que o XSD exige foi recusado; com todos os da exportação, aceito),
 * e o arquivo sem item de produção fora de DADOS-COMPLEMENTARES (um arquivo
 * com só um evento foi recusado). Os textos dos alertas são os observados.
 */
function upload(req: SimRequest, state: LattesState): SimResponse {
  if (state.importRequest) return html(step2(state, `<p>${PENDING_NOTICE}</p>`));
  if (!req.file) return html(step1(state, 'Escolha um arquivo .xml'));
  let root: XElement;
  try {
    root = parseXml(decodeLatin1(req.file.bytes)).root;
  } catch {
    return html(step1(state, DTD_ALERT));
  }
  const general = childElements(root, 'DADOS-GERAIS')[0];
  const required = state.general.attrs.map((a) => a.name);
  if (
    root.name !== 'CURRICULO-VITAE' ||
    !general ||
    required.some((name) => getAttr(general, name) === undefined)
  ) {
    return html(step1(state, DTD_ALERT));
  }
  const found = productionItems(root);
  const scientific = found.some(({ el }) => !isComplementary(root, el));
  if (!scientific) return html(step1(state, NO_PRODUCTION_ALERT));
  state.importRequest = {
    id: String(987000 + Number(state.newImportId())),
    items: found.map(({ el, module, type }) => ({
      el,
      id: String(20 + Number(state.newImportId())),
      module,
      title: itemTitle(el),
      type,
      year: itemYear(el),
    })),
  };
  return html(`<script>alert("${SENT_ALERT}");</script>${step2(state, '')}`);
}

function isComplementary(root: XElement, item: XElement): boolean {
  const complementary = childElements(root, 'DADOS-COMPLEMENTARES')[0];
  let inside = false;
  if (complementary) walk(complementary, (el) => (inside ||= el === item));
  return inside;
}

function modules(req: SimRequest, state: LattesState): SimResponse {
  const request = state.importRequest;
  if (!request || req.get('f_solic') !== request.id) return html(step1(state));
  const ctr = req.get('f_ctr');
  if (ctr === 'D') {
    state.importRequest = undefined;
    return html(step1(state));
  }
  if (ctr !== 'I') return html(step2(state, ''));
  const chosen = req
    .getAll('f_chkp')
    .map(Number)
    .filter((n) => Number.isInteger(n) && n >= 1 && n <= IMPORT_MODULES.length);
  if (!chosen.length) return html(step2(state, ''));
  request.chosen = { modules: chosen, year: Number(req.get('f_ano_prod')) || 0 };
  return html(step3(state));
}

/** A própria pessoa entre os participantes do evento. */
function hasSelf(item: XElement, name: string): boolean {
  return childElements(item, 'PARTICIPANTE-DE-EVENTOS-CONGRESSOS').some(
    (p) =>
      fold(getAttr(p, 'NOME-COMPLETO-DO-PARTICIPANTE-DE-EVENTOS-CONGRESSOS') ?? '') === fold(name),
  );
}

/**
 * Passo 3. Cada item confirmado gasta um SEQUENCIA-PRODUCAO, que o servidor
 * dá, entre ou não no currículo (observado). Quem entra fica na lista e no
 * espelho, sem acender a pendência (observado); o que some depende de
 * importOutcome (o descarte do evento sem a pessoa é observado, a causa é
 * inferida).
 */
function confirm(req: SimRequest, state: LattesState): SimResponse {
  const request = state.importRequest;
  if (!request?.chosen || req.get('f_solic') !== request.id) return html(step1(state));
  const ctr = req.get('f_ctr');
  if (ctr === 'D') {
    state.importRequest = undefined;
    return html(step1(state));
  }
  if (ctr !== 'I') return html(step3(state));
  const picked = new Set(req.getAll('f_sq'));
  const chosen = listed(state).filter((i) => picked.has(i.id));
  if (!chosen.length) return html(step3(state));
  for (const i of chosen) {
    state.nextProduction += 1;
    const seq = String(state.nextProduction);
    const drop =
      state.importOutcome === 'descartar' ||
      (state.importOutcome === 'participante' &&
        i.module === EVENTS_MODULE &&
        !hasSelf(i.el, state.personName));
    state.imported.push({ inserted: !drop, seq, title: i.title });
    if (drop) continue;
    const copy = structuredClone(i.el);
    setAttr(copy, 'SEQUENCIA-PRODUCAO', seq);
    addProduction(lattesSchema, state.working, i.type, copy);
  }
  state.importRequest = undefined;
  return html(`<script>self.parent.caixaMsg.exibir('${DONE_MESSAGE}');</script>`);
}

export const IMPORTAR_ROUTES: Routes = {
  'pkg_importa_xml.inicio': (req, state) => {
    if (req.method === 'POST') return upload(req, state);
    return html(state.importRequest ? step2(state, `<p>${PENDING_NOTICE}</p>`) : step1(state));
  },
  'pkg_importa_xml.mostra_lista_prod': confirm,
  'pkg_importa_xml.mostra_modulos': modules,
};
