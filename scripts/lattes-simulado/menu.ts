// O menu do currículo (PKG_MENU.menu), o login, a tela de envio ao CNPq, a
// página de conferência (cv_espelho), o aviso de pendências e a foto. Textos
// e links do menu como em docs/lattes_internals.md, seções 3, 4, 7, 10 e 14.

import { IMPORT_MODULES } from '../../src/import-export/importable.ts';
import { childElements, getAttr, type XElement } from '../../src/model/xml.ts';
import { areaScript } from './buscas.ts';
import { brDate, type LattesState } from './estado.ts';
import { eventItems } from './eventos.ts';
import * as h from './html.ts';
import { itemTitle } from './importar.ts';
import type { SimRequest } from './pedido.ts';
import { html, type Routes, type SimResponse } from './tipos.ts';

/** O aviso do menu enquanto há alteração não enviada (observado em 12/10/2026). */
export const PENDING_MENU =
  'Existem alterações realizadas em seu currículo que ainda não foram enviadas ao CNPq';

/** Itens do menu: rótulo e procedimento aberto na primeira camada modal. */
function menuItems(code: string): [string, string][] {
  return [
    ['Identificação', `prc_ident?f_cod=${code}&f_pcd=N`],
    ['Endereço', `prc_endereco?f_cod=${code}`],
    ['Idiomas', `pkg_idioma.lista?f_cod=${code}`],
    ['Formação acadêmica/titulação', `pkg_formacao.lista?f_cod=${code}&f_tipo=FA`],
    ['Pós-doutorado e livre-docência', `pkg_formacao.lista?f_cod=${code}&f_tipo=AP`],
    ['Formação complementar', `pkg_formacao_compl.lista?f_cod=${code}`],
    ['Atuação profissional', `pkg_ativ.lista?f_cod=${code}`],
    ['Projetos de pesquisa', `pkg_projeto.lista?f_cod_tipo=P&f_cod=${code}`],
    ['Projetos de desenvolvimento', `pkg_projeto.lista?f_cod_tipo=D&f_cod=${code}`],
    ['Projetos de extensão', `pkg_projeto.lista?f_cod_tipo=E&f_cod=${code}`],
    ['Projetos de ensino', `pkg_projeto.lista?f_cod_tipo=N&f_cod=${code}`],
    ['Outros projetos', `pkg_projeto.lista?f_cod_tipo=O&f_cod=${code}`],
    ['Prêmios e títulos', `pkg_premio.lista?f_cod=${code}`],
    // Observados no menu real em 16/10/2026.
    ['Trabalhos técnicos', `pkg_relatorio.lista?f_cod=${code}`],
    ['Outra produção bibliográfica', `prc_bib_demais_lista?f_cod_tipo=1Z&f_cod=${code}`],
    // As outras listas bibliográficas: as da captura de 13/10/2026 e, para
    // artigos publicados e livros, as do catálogo de menus do reconhecimento.
    ['Artigos completos publicados', `pkg_artigo.lista?f_cod=${code}`],
    ['Artigos aceitos para publicação', `pkg_artigo_pr.lista?f_cod=${code}`],
    ['Livros e capítulos', `pkg_lvr_cap.lista?f_cod=${code}`],
    ['Trabalhos em anais', `pkg_trabalho.lista?f_cod=${code}`],
    ['Textos em jornais ou revistas', `pkg_texto.lista?f_cod=${code}`],
    ['Tradução', `prc_bib_demais_lista?f_cod_tipo=1A&f_cod=${code}`],
    ['Partitura musical', `prc_bib_demais_lista?f_cod_tipo=1B&f_cod=${code}`],
    // Observado no menu real em 18/10/2026.
    ['Prefácio, posfácio', `prc_bib_demais_lista?f_cod_tipo=1C&f_cod=${code}`],
    ['Patentes', `PKG_PATENTE_REGISTRO.LISTA?f_cod_tipo=PP&f_cod=${code}`],
    // As listas de orientações e bancas, como na captura de 13/10/2026 (docs/lattes-listas/).
    ['Orientações concluídas', `pkg_orient.lista?f_tipo=C&f_cod=${code}`],
    ['Orientações em andamento', `pkg_orient.lista?f_tipo=A&f_cod=${code}`],
    ['Bancas de trabalhos de conclusão', `pkg_banca_trab.lista?f_cod=${code}`],
    ['Bancas julgadoras', `pkg_banca_julg.lista?f_cod=${code}`],
    // Produções técnicas e artísticas: as listas da captura de 13/10/2026
    // (docs/lattes-listas/), de onde se abriu cada inclusão. Inferido: que o
    // menu as abra com esses parâmetros (a das artísticas foi vista só com
    // f_sta_divulgacao_cientifica=S).
    ['Produtos tecnológicos', `pkg_produto.lista?f_cod=${code}`],
    ['Processos ou técnicas', `pkg_processo.lista?f_cod=${code}`],
    ...(
      [
        ['Apresentação de trabalho', '2J'],
        ['Cartas, mapas ou similares', '2A'],
        ['Curso de curta duração ministrado', '2B'],
        ['Desenvolvimento de material didático ou instrucional', '2C'],
        ['Editoração', '2D'],
        ['Manutenção de obra artística', '2E'],
        ['Maquete', '2F'],
        ['Organização de evento', '2G'],
        ['Programa de rádio ou TV', '2H'],
        ['Relatório de pesquisa', '2I'],
        ['Redes sociais, websites e blogs', '2L'],
        ['Outra produção técnica', '2Z'],
      ] as const
    ).map(([label, tipo]): [string, string] => [
      label,
      `prc_tec_demais_lista?f_cod_tipo=${tipo}&f_cod=${code}`,
    ]),
    ...(
      [
        ['Artes cênicas', 'AC'],
        ['Música', 'MU'],
        ['Artes visuais', 'AV'],
        ['Outra produção artística/cultural', 'OU'],
      ] as const
    ).map(([label, tipo]): [string, string] => [
      label,
      `pkg_arte_nova.lista?f_cod_tipo=${tipo}&f_cod=${code}`,
    ]),
    // Os outros registros: a mesma lista com outro f_cod_tipo (reconhecimento,
    // catálogo de menus; o parâmetro de cada um no menu é inferido).
    ...(
      [
        ['Cultivar protegida', 'CP'],
        ['Cultivar registrada', 'CR'],
        ['Desenho industrial', 'DI'],
        ['Marca', 'MR'],
        ['Topografia de circuito integrado', 'TC'],
      ] as const
    ).map(([label, tipo]): [string, string] => [
      label,
      `PKG_PATENTE_REGISTRO.LISTA?f_cod_tipo=${tipo}&f_cod=${code}`,
    ]),
    ['Resumo', `pkg_resume.prc_resume?f_cod=${code}`],
    // Catálogo de menus do reconhecimento de 10/10/2026 e censo de 15/10/2026.
    ['Outras informações relevantes', `prc_outras_inf?f_cod=${code}`],
    ['Participação em eventos', `pkg_evento.lista?f_cod=${code}`],
    [
      'Eventos de divulgação científica',
      `pkg_evento.lista?f_sta_divulgacao_cientifica=S&f_cod=${code}`,
    ],
    ['Exportar', `pkg_impcv.get_arquivo?f_cod=${code}`],
    ['Importar', `pkg_importa_xml.inicio?f_cod=${code}`],
    ['Enviar', `pkg_publicar.mostrar_cv?f_cod=${code}`],
  ];
}

/**
 * As camadas modais do menu (modalCV1 a modalCV3) e a caixa de mensagem,
 * reduzidas a um iframe: o bastante para clicar no simulado pelo navegador.
 */
const MENU_SCRIPT = `<script>
function camada(){ return { setarUrl: function(url){ document.getElementById('camada').src = url; } }; }
var modalCV1 = camada(), modalCV2 = camada(), modalCV3 = camada();
var caixaMsg = { exibir: function(msg){ alert(msg && msg.conteudo ? msg.conteudo : msg); } };
function checkPublicacao(){ }
function fecharModal(){ document.getElementById('camada').src = 'about:blank'; }
var fotoWin = { abrir: function(){ modalCV1.setarUrl('prc_upload_foto?f_cod=__COD__&f_ret=MENU'); } };
</script>`;

/**
 * O vetor autorDP do menu: as linhas l, c, t e deletable, nessa ordem
 * (observado no lote 4 da recaptura de 15/10/2026), a da própria pessoa com o
 * código vazio e as de coautores com um número. Os coautores são sintéticos.
 */
function authorScript(state: LattesState): string {
  const dg = state.general;
  const citation = getAttr(dg, 'NOME-EM-CITACOES-BIBLIOGRAFICAS')?.split(';')[0] ?? '';
  const rows = [
    { c: '', l: state.personName, t: citation },
    { c: '3', l: 'Coautora de Exemplo', t: 'EXEMPLO, C.' },
  ]
    .map((r) => `{l:'${h.jsString(r.l)}',c:'${r.c}',t:'${h.jsString(r.t)}',deletable:false}`)
    .join(',');
  return `<script>var autorDP = [${rows}];</script>`;
}

function menu(state: LattesState): SimResponse {
  const links = menuItems(state.code)
    .map(
      ([label, url]) =>
        `<li><a href="#" onclick="modalCV1.setarUrl('${url.replace(/&/g, '&amp;')}', true); return false;">${h.esc(label)}</a></li>`,
    )
    .join('\n');
  const pending = state.pending ? `<li class="aviso">${PENDING_MENU}</li>` : '';
  const body = `<p>${h.esc(state.personName)} · <a href="http://lattes.cnpq.br/${state.lattesId}">http://lattes.cnpq.br/${state.lattesId}</a></p>
<p>Última atualização: ${brDate(state.lastUpdate)} · Última publicação: ${brDate(state.lastPublished)}</p>
<ul class="avisos">${pending}</ul>
<p><a href="#" onclick="fotoWin.abrir(); return false;"><img src="pkg_util_img.show_foto?v_cod=${state.code}" width="60" alt="Foto"></a></p>
<div style="display:flex;gap:16px"><ul>${links}</ul>
<iframe id="camada" style="flex:1;height:70vh;border:1px solid #ccc"></iframe></div>
${MENU_SCRIPT.replace('__COD__', state.code)}
${areaScript()}
${authorScript(state)}`;
  return html(h.page('Currículo Lattes', body));
}

function logon(req: SimRequest, state: LattesState): SimResponse {
  if (req.method === 'POST') {
    state.sessionActive = true;
    return { headers: { Location: 'PKG_MENU.menu' }, html: '', status: 302 };
  }
  // Inferido: o login de verdade passa pelo Keycloak de login.cnpq.br.
  return html(
    h.page(
      'Entrar',
      `<form name="logon" method="post" action="pkg_sec.logon"><input type="submit" value="Entrar no Lattes simulado"></form>`,
    ),
  );
}

/**
 * A declaração do simulado. Não é o texto do CNPq, que não foi registrado:
 * serve só para o editor ter o que mostrar ao lado da caixa.
 */
export const SIMULATED_DECLARATION =
  'Declaro, para os fins do Lattes simulado, que as informações deste currículo de teste são fictícias.';

/**
 * A tela de envio. Observado em 14/10/2026: o formulário publicar só declara
 * f_chk, o enviar() da página monta o resto e navega por GET para
 * pkg_publicar.enviar, depois das consultas de raça ou cor e de e-mail.
 * Inferido: o desenho da tela, o texto da declaração (SIMULATED_DECLARATION),
 * o link do Termo de Uso e os controles de idioma, versão em inglês e e-mails
 * com os nomes dos parâmetros do GET.
 */
function sendScreen(state: LattesState): SimResponse {
  const body = `<p><a href="pkg_publicar.cv_espelho?f_cod=${state.code}&amp;f_idioma=1">Versão em Português</a></p>
<table>
<tr><td>Idioma principal:</td><td>${h.radios(
    'f_idioma',
    [
      ['1', 'Português'],
      ['2', 'Inglês'],
    ],
    '1',
  )}</td></tr>
<tr><td>Versão em inglês:</td><td><label>${h.checkbox('f_chk_en', '1', true)} Autorizo a publicação da versão em inglês</label></td></tr>
<tr><td>E-mail de contato:</td><td>${h.text('f_email_contato', state.contactEmail)}</td></tr>
<tr><td>E-mail alternativo:</td><td>${h.text('f_email_alternativo', '')}</td></tr>
</table>
<form name="publicar" method="get" action="pkg_publicar.enviar">
<label>${h.checkbox('f_chk', '1', false)} ${h.esc(SIMULATED_DECLARATION)}</label>
<p><a href="termo_de_uso_simulado" target="_blank">Termo de Uso</a></p>
</form>
<p><a href="#" onclick="enviar(); return false;">Enviar ao CNPq</a> <a href="#" onclick="self.parent.fecharModal(); return false;">Cancelar</a></p>
<script>async function enviar(){ if (!document.forms['publicar'].f_chk.checked) { alert('Marque a declaração.'); return; }
var post = function(proc, body){ return fetch(proc, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body }).then(function(r){ return r.json(); }); };
var contato = document.querySelector('input[name=f_email_contato]').value, alternativo = document.querySelector('input[name=f_email_alternativo]').value;
if (!(await post('pkg_publicar.racapreenchida_raca_cor', 'f_cod=${state.code}')).status) { alert('Preencha raça ou cor.'); return; }
for (var e of [contato, alternativo]) { if ((await post('pkg_util.existe_email_cadastrado', 'f_email=' + encodeURIComponent(e) + '&f_cod=${state.code}')).existe) { alert('E-mail já cadastrado.'); return; } }
var idioma = document.querySelector('input[name=f_idioma]:checked');
location = 'pkg_publicar.enviar?f_chk=1&f_idioma=' + (idioma ? idioma.value : '1') + '&f_chk_en=1&f_email_contato=' + encodeURIComponent(contato) + '&f_email_alternativo=' + encodeURIComponent(alternativo) + '&f_cod=${state.code}&f_ctr=U'; }</script>`;
  return html(h.page('Enviar ao CNPq', body));
}

/**
 * O envio (observado em 14/10/2026): GET com f_chk=1 e f_ctr=U, resposta com
 * um alert nativo; depois, as duas datas do menu são as do dia, o aviso de
 * pendência some e o Exportar volta a exportar. O simulado guarda o e-mail
 * de contato que veio no pedido. As duas consultas de antes (raça ou cor e
 * e-mail) ficam com o enviar() da tela, como na página observada; esta rota
 * não as confere.
 */
function send(req: SimRequest, state: LattesState): SimResponse {
  if (req.get('f_chk') !== '1' || req.get('f_ctr') !== 'U') return sendScreen(state);
  const now = new Date();
  state.publish(now);
  state.lastUpdate = now;
  state.contactEmail = req.get('f_email_contato') ?? state.contactEmail;
  return html(
    h.page('Enviar ao CNPq', '<script>alert("O currículo foi enviado para publicação.");</script>'),
  );
}

const sectionLine = (title: string) => `<div><b>${h.esc(title)}</b></div>`;

/** Os itens de produção, por módulo, como linhas "AUTORES. Título, ano." (inferido). */
function productionLines(state: LattesState): string[] {
  const lines: string[] = [];
  for (const module of IMPORT_MODULES) {
    if (module.id === 'eventos' || module.id === 'bancas' || module.id === 'orientacoes') continue;
    const items = module.paths.flatMap((path) => {
      const parts = path.split('/');
      const last = parts.pop()!;
      const container = state.find(parts);
      if (!container) return [];
      return childElements(container).filter((c) =>
        last === '*' ? !module.exclude?.includes(c.name) : c.name === last,
      );
    });
    if (!items.length) continue;
    lines.push(`<div>${h.esc(module.label)}</div>`);
    items.forEach((item, i) => {
      const authors = childElements(item, 'AUTORES').map(
        (a) => getAttr(a, 'NOME-PARA-CITACAO')?.split(';')[0]?.trim() ?? '',
      );
      lines.push(
        `<div>${i + 1}. ${h.esc(`${authors.join('; ')}. ${itemTitle(item)}, ${yearOf(item)}.`)}</div>`,
      );
    });
  }
  return lines;
}

const yearOf = (item: XElement) =>
  childElements(item)
    .find((c) => c.name.startsWith('DADOS-BASICOS'))
    ?.attrs.find((a) => /^ANO($|-DO-)/.test(a.name))?.value ?? '';

function espelho(_req: SimRequest, state: LattesState): SimResponse {
  const events = eventItems(state).map((item, i) => {
    const detail = childElements(item).find((c) => c.name.startsWith('DETALHAMENTO'));
    const name = (detail && getAttr(detail, 'NOME-DO-EVENTO')) ?? '';
    return `<div>${i + 1}. ${h.esc(`${name}. ${itemTitle(item) || 'Produção sem título'}. ${yearOf(item)}.`)}</div>`;
  });
  const body = [
    sectionLine('Identificação'),
    `<div>${h.esc(state.personName)}</div>`,
    sectionLine('Producão'),
    ...productionLines(state),
    sectionLine('Eventos'),
    ...(events.length ? ['<div>Participação em eventos</div>', ...events] : []),
    sectionLine('Totais de produção'),
    '<div>Este arquivo não foi gerado a partir do Currículo Lattes validado e disponível publicamente.</div>',
  ].join('\n');
  return html(h.page('Currículo', body));
}

function photoScreen(_req: SimRequest, state: LattesState): SimResponse {
  const body = `<p>Envie uma imagem no formato JPEG com tamanho de até 70kB.</p>
<form name="fl" method="post" action="PRC_UPLOAD_FOTO" enctype="multipart/form-data">
<input type="file" name="file" accept="image/jpg,image/jpeg">
${h.hidden('f_cod', state.code)}${h.hidden('f_ctr', '')}${h.hidden('f_ret', 'MENU')}
<input type="button" value="Salvar" onclick="dc.f_ctr.value = 'I'; dc.submit();">
<input type="button" value="Excluir" onclick="dc.f_ctr.value = 'E'; dc.submit();">
</form><script>var dc = document.forms['fl'];</script>`;
  return html(h.page('Enviar sua foto', body));
}

/** A resposta que o script da janela espera, { success, message }: inferido do código. */
function photoUpload(req: SimRequest, state: LattesState): SimResponse {
  const reply = (success: boolean, message: string): SimResponse => ({
    contentType: 'application/json',
    html: JSON.stringify({ message, success }),
  });
  if (req.get('f_ctr') !== 'I') return reply(false, 'Operação não simulada.');
  const bytes = req.file?.bytes;
  if (!bytes || bytes[0] !== 0xff || bytes[1] !== 0xd8)
    return reply(false, 'A foto precisa ser JPEG.');
  if (bytes.length > 70_000) return reply(false, 'A foto passa de 70kB.');
  state.photo = bytes;
  return reply(true, 'Foto enviada.');
}

export const MENU_ROUTES: Routes = {
  'pkg_aviso_pendencia.inicio': (_req, state) =>
    html(
      h.page('Pendências', state.pending ? `<p>${PENDING_MENU}</p>` : '<p>Nenhuma pendência.</p>'),
    ),
  'pkg_menu.menu': (_req, state) => menu(state),
  'pkg_publicar.cv_espelho': espelho,
  'pkg_publicar.enviar': send,
  'pkg_publicar.mostrar_cv': (_req, state) => sendScreen(state),
  // As duas consultas que a tela de envio faz antes de enviar (observadas).
  'pkg_publicar.racapreenchida_raca_cor': () => ({
    contentType: 'application/json',
    html: '{"status": true}',
  }),
  'pkg_sec.logon': logon,
  'pkg_util_img.show_foto': (_req, state) => ({ bytes: state.photo, contentType: 'image/jpeg' }),
  'pkg_util.existe_email_cadastrado': () => ({
    contentType: 'application/json',
    html: '{"existe":false ,"mensagem":"Email não encontrado"}',
  }),
  prc_upload_foto: (req, state) =>
    req.method === 'POST' ? photoUpload(req, state) : photoScreen(req, state),
  // A página do link "Termo de Uso" da tela de envio do simulado.
  termo_de_uso_simulado: () =>
    html(h.page('Termo de Uso', '<p>Termo de Uso do Lattes simulado, só para testes.</p>')),
};
