// Importar pelo conector (LAT-50): os itens novos vão pelo Importar do próprio
// Lattes, num arquivo só com eles (guia, 3.3, opção 1), na sessão da pessoa.
// Ver docs/lattes_internals.md, seção 13.
//
// O caminho observado em 13/10/2026:
// - passo 1: a tela pkg_importa_xml.inicio?f_cod=<código> tem o formulário
//   "fl", POST multipart para pkg_importa_xml.inicio, com o arquivo em "file"
//   e os ocultos f_cod, f_ctr=I e f_ret (vazio);
// - passo 2: a resposta é o formulário pkg_imp_xml, POST para
//   pkg_importa_xml.mostra_modulos, com f_cod, f_solic, f_ctr, uma caixa
//   f_chkp por módulo (1 a 17), f_all e o filtro de ano f_ano_prod. O
//   "Confirmar" põe f_ctr=I e envia.
//
// O passo 3 foi visto uma vez, no teste acompanhado de 14/10/2026 (seção 13):
// formulário pkg_imp_xml, POST para pkg_importa_xml.mostra_lista_prod, uma
// caixa f_sq por item com um id do servidor (não o SEQUENCIA-PRODUCAO) e
// <b class="quadrado verde|vermelho"> em cada linha. O Confirmar dele disse
// "A operação foi realizada com sucesso! !" e o item não entrou no currículo.
// Enquanto não se souber por quê, o fluxo para na resposta do passo 2, seja
// ela qual for, sem nenhum POST a mais, e devolve só a forma da página. A
// solicitação criada no passo 1 fica pendente no Lattes, à espera de
// Confirmar ou Descartar pela pessoa. Uma solicitação pendente encontrada
// antes de começar também para o fluxo: o conector nunca descarta nada.
//
// No mesmo teste, o passo 1 recusou o arquivo mínimo com dois alertas
// (STEP1_REJECTIONS); o conector os reconhece e para sem solicitação criada.

import { decodeHtmlEntities, foldText, plainText } from './html-text.ts';
import { isLogonPage } from './lattes-html.ts';

/**
 * Ligado para o teste ao vivo, a pedido do dono. O teste acompanhado de
 * 14/10/2026 (lattes_internals.md, seção 13) mostrou o risco: o Lattes recusa
 * o arquivo mínimo no passo 1, e um Confirmar do passo 3 com mensagem de
 * sucesso não pôs o item no currículo. Cada importação pede, depois, a
 * conferência por uma exportação nova. Com false, o editor não dispara o
 * fluxo e a extensão recusa o pedido; as instruções do Importar à mão seguem.
 */
export const IMPORT_ENABLED = true;

/** Valor da caixa f_chkp de cada módulo (src/import-export/importable.ts), na ordem da tela. */
export const STEP2_MODULE_VALUES: Readonly<Record<string, number>> = {
  anais: 4,
  apresentacao: 6,
  artigos: 1,
  'artigos-aceitos': 2,
  artistica: 13,
  bancas: 17,
  'demais-trabalhos': 15,
  eventos: 16,
  'livros-capitulos': 3,
  orientacoes: 14,
  'outras-bibliograficas': 7,
  'outras-tecnicas': 12,
  processos: 10,
  produtos: 9,
  softwares: 8,
  'textos-jornal': 5,
  'trabalhos-tecnicos': 11,
};

const MODULE_COUNT = 17;

export interface ImportPort {
  /** GET de um caminho relativo a /cvlattesweb/; texto decodificado de Latin-1. */
  get(path: string): Promise<{ html: string; url: string }>;
  /** POST de formulário (application/x-www-form-urlencoded). */
  post(path: string, body: string): Promise<{ html: string; url: string }>;
  /** POST multipart: o arquivo primeiro, depois os campos na ordem dada. */
  postMultipart(
    path: string,
    fields: [name: string, value: string][],
    file: { bytes: Uint8Array; field: string; name: string; type: string },
  ): Promise<{ html: string; url: string }>;
}

export interface ImportRequest {
  file: Uint8Array;
  fileName: string;
  /** Valores f_chkp dos módulos que o arquivo traz (STEP2_MODULE_VALUES). */
  modules: number[];
  /** Ano do item novo mais antigo, para o filtro do passo 2. */
  oldestYear?: number;
}

/**
 * Por que o fluxo parou. "passo-3" é o fim esperado enquanto o passo 3 não
 * for mapeado: os passos 1 e 2 foram feitos e nada mais foi enviado.
 */
export type ImportStop =
  | 'arquivo'
  | 'consentimento'
  | 'desligado'
  | 'erro'
  | 'mudou'
  | 'outro-cv'
  | 'passo-3'
  | 'pendente'
  | 'sem-aba'
  | 'sessao';

/** Só a estrutura de uma página do Lattes, sem o conteúdo dos campos. */
export interface PageShape {
  /** Rótulos de botões (input button/submit e <button>). */
  buttons: string[];
  forms: { action?: string; fields: string[]; name?: string }[];
  title?: string;
}

export interface ImportResult {
  detail?: string;
  /** Forma da página em que o fluxo parou, quando ela não é conhecida. */
  page?: PageShape;
  reason: ImportStop;
  /** Número da solicitação criada no passo 1 (f_solic), que fica pendente no Lattes. */
  request?: string;
}

/** Valor de um atributo numa tag HTML, com entidades resolvidas. */
function attrOf(tag: string, name: string): string | undefined {
  const m = new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i').exec(tag);
  if (!m) return undefined;
  return decodeHtmlEntities(m[1] ?? m[2] ?? m[3] ?? '');
}

/** O formulário com esse nome: a tag de abertura e o que vem até o fechamento. */
function formBlock(html: string, name: string): { body: string; tag: string } | undefined {
  const re = new RegExp(`<form\\b[^>]*\\sname\\s*=\\s*["']?${name}["'\\s>][^>]*>`, 'i');
  const m = re.exec(html);
  if (!m) return undefined;
  const rest = html.slice(m.index + m[0].length);
  const end = rest.search(/<\/form\s*>/i);
  return { body: end < 0 ? rest : rest.slice(0, end), tag: m[0] };
}

interface Control {
  name: string;
  /** Opções de um select. */
  options?: string[];
  type: string;
  value: string;
}

/** Controles com nome de um trecho de formulário, na ordem do HTML. */
function controlsIn(body: string): Control[] {
  const out: Control[] = [];
  const re = /<(input|textarea|button)\b[^>]*>|<select\b[^>]*>([\s\S]*?)<\/select\s*>/gi;
  for (const m of body.matchAll(re)) {
    const tag = m[0];
    const name = attrOf(tag, 'name');
    if (!name) continue;
    if (m[1] === undefined) {
      const options = [...(m[2] ?? '').matchAll(/<option\b[^>]*>/gi)].map(
        (o) => attrOf(o[0], 'value') ?? '',
      );
      out.push({ name, options, type: 'select', value: '' });
      continue;
    }
    const kind = m[1].toLowerCase();
    const type = kind === 'input' ? (attrOf(tag, 'type') ?? 'text').toLowerCase() : kind;
    out.push({ name, type, value: attrOf(tag, 'value') ?? '' });
  }
  return out;
}

/**
 * Alertas com que o passo 1 recusa o arquivo, vistos em 14/10/2026 (sem
 * acento nem caixa). Nenhum cria solicitação.
 */
const STEP1_REJECTIONS = [
  /nao foi possivel processar o arquivo enviado/,
  /nao contem producoes cientificas/,
];

/** O alerta de recusa do passo 1, como o Lattes escreveu, ou undefined. */
export function step1Rejection(html: string): string | undefined {
  const text = decodeHtmlEntities(html);
  for (const re of STEP1_REJECTIONS) {
    if (!re.test(foldText(text))) continue;
    // O texto do alert(), com acentos, para a pessoa ler como o Lattes disse.
    for (const m of text.matchAll(/alert\(\s*(["'])([\s\S]*?)\1\s*\)/gi)) {
      if (re.test(foldText(m[2] ?? ''))) return m[2]!.replace(/\\n/g, ' ').trim();
    }
    return 'O Lattes recusou o arquivo.';
  }
  return undefined;
}

/** O aviso do Importar quando o passo 1 já foi feito e ninguém confirmou nem descartou. */
const PENDING = /existe solicitacao de importacao de xml pendente/;

function isPending(html: string): boolean {
  return PENDING.test(foldText(plainText(html))) || formBlock(html, 'pkg_imp_xml') !== undefined;
}

/** A tela do passo 1: o formulário como lido, uma solicitação pendente, a sessão caída ou outra tela. */
export function step1ScreenState(html: string, url = ''): 'mudou' | 'ok' | 'pendente' | 'sessao' {
  if (isLogonPage(html, url)) return 'sessao';
  if (isPending(html)) return 'pendente';
  const form = formBlock(html, 'fl');
  if (!form) return 'mudou';
  const names = new Set(controlsIn(form.body).map((c) => c.name));
  const ok =
    /pkg_importa_xml\.inicio/i.test(attrOf(form.tag, 'action') ?? '') &&
    /multipart\/form-data/i.test(attrOf(form.tag, 'enctype') ?? '') &&
    ['file', 'f_cod', 'f_ctr', 'f_ret'].every((n) => names.has(n));
  return ok ? 'ok' : 'mudou';
}

export interface Step2Form {
  code: string;
  request: string;
  /** Anos do filtro f_ano_prod, como aparecem. */
  years: number[];
}

/** Os campos que o formulário do passo 2 tem, e nenhum outro (seção 13). */
const STEP2_FIELDS = new Set(['f_cod', 'f_solic', 'f_ctr', 'f_chkp', 'f_all', 'f_ano_prod']);

/**
 * Lê o formulário do passo 2 e confere que ele é o mapeado: ação, campos,
 * as 17 caixas de módulo e o filtro de ano. Devolve o porquê quando não é.
 */
export function readStep2(html: string): Step2Form | { problem: string } {
  const form = formBlock(html, 'pkg_imp_xml');
  if (!form) return { problem: 'O Lattes não mostrou o passo 2 do Importar depois do envio.' };
  if (!/pkg_importa_xml\.mostra_modulos/i.test(attrOf(form.tag, 'action') ?? '')) {
    return { problem: 'O formulário do passo 2 aponta para outro lugar.' };
  }
  const controls = controlsIn(form.body);
  const extra = [...new Set(controls.map((c) => c.name))].filter((n) => !STEP2_FIELDS.has(n));
  if (extra.length) {
    return { problem: `O passo 2 tem campos que o conector não conhece: ${extra.join(', ')}.` };
  }
  const value = (name: string) => controls.find((c) => c.name === name)?.value.trim();
  const code = value('f_cod');
  const request = value('f_solic');
  if (!code || !request || !controls.some((c) => c.name === 'f_ctr')) {
    return { problem: 'O passo 2 não tem f_cod, f_solic ou f_ctr.' };
  }
  // O f_chkp oculto com "dummy" (observado no passo 2 em 14/10/2026, seção
  // 13) não é caixa de módulo.
  const boxes = controls
    .filter((c) => c.name === 'f_chkp' && !(c.type === 'hidden' && c.value === 'dummy'))
    .map((c) => (c.type === 'checkbox' ? Number(c.value) : NaN))
    .sort((a, b) => a - b);
  const expected = Array.from({ length: MODULE_COUNT }, (_, i) => i + 1);
  if (boxes.join() !== expected.join()) {
    return { problem: 'As caixas de módulo do passo 2 não são as 17 mapeadas.' };
  }
  // O filtro de ano: um select ou botões de opção, os dois servem.
  const years = controls
    .filter((c) => c.name === 'f_ano_prod')
    .flatMap((c) => c.options ?? [c.value])
    .map((v) => v.trim())
    .filter((v) => /^\d{4}$/.test(v))
    .map(Number);
  if (!years.length) return { problem: 'O passo 2 não tem o filtro de ano (f_ano_prod).' };
  return { code, request, years };
}

/**
 * O ano do filtro "Produção C&T a partir de": o do item mais antigo se a tela
 * o oferece, senão o maior ano anterior a ele; sem ano conhecido, o mais
 * antigo da tela. Nenhum ano que cubra os itens: undefined.
 */
export function pickYear(years: number[], oldest: number | undefined): number | undefined {
  if (oldest === undefined) return Math.min(...years);
  const covering = years.filter((y) => y <= oldest);
  return covering.length ? Math.max(...covering) : undefined;
}

/** A forma de uma página: título, formulários com seus campos e botões. Nada dos valores. */
export function pageShape(html: string): PageShape {
  const title = /<title[^>]*>([\s\S]*?)<\/title\s*>/i.exec(html)?.[1];
  const forms = [...html.matchAll(/<form\b[^>]*>/gi)].map((m) => {
    const rest = html.slice(m.index + m[0].length);
    const end = rest.search(/<\/form\s*>/i);
    const body = end < 0 ? rest : rest.slice(0, end);
    return {
      action: attrOf(m[0], 'action'),
      fields: [...new Set(controlsIn(body).map((c) => c.name))],
      name: attrOf(m[0], 'name'),
    };
  });
  const buttons = [
    ...[...html.matchAll(/<input\b[^>]*>/gi)]
      .map((m) => m[0])
      .filter((tag) => /^(button|submit)$/i.test(attrOf(tag, 'type') ?? ''))
      .map((tag) => attrOf(tag, 'value') ?? ''),
    ...[...html.matchAll(/<button\b[^>]*>([\s\S]*?)<\/button\s*>/gi)].map((m) =>
      plainText(m[1] ?? ''),
    ),
  ]
    .map((b) => b.trim())
    .filter(Boolean);
  return { buttons, forms, title: title ? plainText(title).trim() || undefined : undefined };
}

/** O que dá para conferir no pedido antes de tocar no Lattes. */
export function requestProblem(req: ImportRequest): string | undefined {
  // O "Enviar" do passo 1 (check()) só aceita nome terminado em .xml.
  if (!/\.xml$/i.test(req.fileName)) return 'O arquivo precisa terminar em .xml.';
  if (req.file.length === 0) return 'O arquivo está vazio.';
  const valid = req.modules.every((m) => Number.isInteger(m) && m >= 1 && m <= MODULE_COUNT);
  if (!req.modules.length || !valid) return 'Nenhum módulo do passo 2 para marcar.';
  return undefined;
}

const pendingNote = (request: string) =>
  `A solicitação ${request} ficou pendente no Importar do Lattes; confirme ou descarte por lá.`;

/**
 * Passos 1 e 2 do Importar. Abre a tela do passo 1 (que diz se a sessão caiu
 * ou se há solicitação pendente), envia o arquivo, confere o formulário do
 * passo 2, marca só os módulos do arquivo e o ano, e confirma o passo 2. A
 * resposta, que seria o passo 3, não é lida além da forma, e nada mais é
 * enviado.
 */
export async function importItems(
  port: ImportPort,
  code: string | undefined,
  req: ImportRequest,
  enabled = IMPORT_ENABLED,
): Promise<ImportResult> {
  if (!enabled) {
    return { detail: 'O Importar pelo conector está desligado.', reason: 'desligado' };
  }
  const problem = requestProblem(req);
  if (problem) return { detail: problem, reason: 'arquivo' };
  if (!code)
    return { detail: 'Não achei o código do currículo no menu do Lattes.', reason: 'erro' };

  const screen = await port.get(`pkg_importa_xml.inicio?f_cod=${code}`);
  const state = step1ScreenState(screen.html, screen.url);
  if (state === 'sessao') return { reason: 'sessao' };
  if (state === 'pendente') {
    return {
      detail:
        'Existe solicitação de Importação de XML pendente no Lattes. Confirme ou descarte por lá antes de importar de novo.',
      reason: 'pendente',
    };
  }
  if (state === 'mudou') {
    return {
      detail: 'A tela do Importar do Lattes mudou.',
      page: pageShape(screen.html),
      reason: 'mudou',
    };
  }

  // Daqui em diante o Lattes pode já ter criado a solicitação: uma falha de
  // rede ou de leitura não pode sumir sem avisar que algo ficou pendente.
  const known: { request?: string } = {};
  try {
    return await uploadAndSelect(port, code, req, known);
  } catch {
    return {
      detail: known.request
        ? `O Lattes parou de responder no meio do Importar. ${pendingNote(known.request)}`
        : 'O Lattes parou de responder depois do envio do arquivo. Se ele criou uma solicitação, ela ficou pendente no Importar; confirme ou descarte por lá.',
      reason: 'erro',
      request: known.request,
    };
  }
}

/** Passo 1 (envio) e passo 2; known.request recebe o f_solic assim que ele aparece. */
async function uploadAndSelect(
  port: ImportPort,
  code: string,
  req: ImportRequest,
  known: { request?: string },
): Promise<ImportResult> {
  const step2 = await port.postMultipart(
    'pkg_importa_xml.inicio',
    [
      ['f_cod', code],
      ['f_ctr', 'I'],
      ['f_ret', ''],
    ],
    { bytes: req.file, field: 'file', name: req.fileName, type: 'text/xml' },
  );
  if (isLogonPage(step2.html, step2.url)) return { reason: 'sessao' };
  const rejected = step1Rejection(step2.html);
  if (rejected) {
    // Em 28/10/2026 a resposta trouxe, um depois do outro, o alerta de
    // sucesso e o do DTD, e mesmo assim a solicitação ficou criada e o passo 3
    // listou o item: a tela do passo 1 diz se há uma pendente.
    const after = await port.get(`pkg_importa_xml.inicio?f_cod=${code}`);
    if (step1ScreenState(after.html, after.url) === 'pendente') {
      return {
        detail: `${rejected} Mesmo assim, o Lattes criou uma solicitação, que ficou pendente no Importar; confirme ou descarte por lá.`,
        reason: 'pendente',
      };
    }
    return {
      detail: `${rejected} Nenhuma solicitação foi criada no Lattes.`,
      reason: 'arquivo',
    };
  }
  const form = readStep2(step2.html);
  if ('problem' in form) {
    return {
      detail: `${form.problem} Se o Lattes criou uma solicitação, ela ficou pendente no Importar.`,
      page: pageShape(step2.html),
      reason: 'mudou',
    };
  }
  known.request = form.request;
  if (form.code !== code) {
    return {
      detail: `O passo 2 é de outro currículo. ${pendingNote(form.request)}`,
      reason: 'outro-cv',
      request: form.request,
    };
  }
  const year = pickYear(form.years, req.oldestYear);
  if (year === undefined) {
    return {
      detail: `O filtro de ano do passo 2 não chega a ${req.oldestYear}. ${pendingNote(form.request)}`,
      reason: 'mudou',
      request: form.request,
    };
  }

  // Os campos e a ordem do envio do próprio navegador no passo 2, observados
  // em 14/10/2026: f_cod, f_solic, f_chkp=dummy, f_ctr=I, os módulos e o ano.
  const body = new URLSearchParams([
    ['f_cod', code],
    ['f_solic', form.request],
    ['f_chkp', 'dummy'],
    ['f_ctr', 'I'],
    ...[...new Set(req.modules)]
      .sort((a, b) => a - b)
      .map((m): [string, string] => ['f_chkp', String(m)]),
    ['f_ano_prod', String(year)],
  ]).toString();
  const step3 = await port.post('pkg_importa_xml.mostra_modulos', body);
  if (isLogonPage(step3.html, step3.url)) {
    return { detail: pendingNote(form.request), reason: 'sessao', request: form.request };
  }
  // Parada explícita: o passo 3 não foi mapeado, e nada é confirmado.
  return {
    detail: `Passo 3 ainda não mapeado: o conector parou sem confirmar. ${pendingNote(form.request)}`,
    page: pageShape(step3.html),
    reason: 'passo-3',
    request: form.request,
  };
}

/** O que dizer quando o Importar pelo conector parou. */
export function importStopMessage(result: Pick<ImportResult, 'detail' | 'reason'>): string {
  switch (result.reason) {
    case 'consentimento':
      return 'Aceite o aviso da extensão antes de importar.';
    case 'sem-aba':
      return 'A extensão não achou o Lattes aberto. Entre no currículo numa aba do navegador e tente de novo.';
    case 'sessao':
      return result.detail
        ? `A sessão do Lattes caiu. ${result.detail}`
        : 'A sessão do Lattes caiu. Entre de novo e tente outra vez.';
    case 'outro-cv':
      return result.detail ?? 'A sessão aberta no Lattes é de outro currículo.';
    default:
      return result.detail ?? 'A importação não foi feita no Lattes.';
  }
}

/**
 * O Importar não começa com a fila de alterações rodando, com a conferência
 * do contrato, com uma troca de foto ou com outra importação em andamento:
 * todos usam a mesma sessão e a mesma aba.
 */
export function importBusy(busy: {
  importing: boolean;
  photo: boolean;
  queue: boolean;
  verifying: boolean;
}): ImportResult | undefined {
  if (busy.queue || busy.photo || busy.importing || busy.verifying) {
    return {
      detail: 'A extensão já está enviando algo ao Lattes. Espere terminar e tente de novo.',
      reason: 'erro',
    };
  }
  return undefined;
}
