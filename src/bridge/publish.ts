// Enviar ao CNPq pelo editor (LAT-54): o conector repete, na sessão da pessoa,
// o que a tela de envio do Lattes faz, e confere pelo menu que o currículo
// foi publicado. Ver docs/lattes_internals.md, seção 10, "Enviar ao CNPq".
//
// Observado em 14/10/2026 (envio real feito pela pessoa, com a página só lida):
// - a tela é pkg_publicar.mostrar_cv?f_cod=…; o formulário "publicar" declara
//   só f_chk (a declaração), e o enviar() da página monta o resto;
// - antes do envio, POST pkg_publicar.racapreenchida_raca_cor (f_cod), que
//   respondeu {"status": true}, e POST pkg_util.existe_email_cadastrado
//   (f_email, f_cod), uma vez para cada e-mail, que respondeu
//   {"existe":false ,"mensagem":"Email não encontrado"};
// - o envio é um GET para pkg_publicar.enviar com f_chk=1, f_idioma=1,
//   f_chk_en=1, f_email_contato, f_email_alternativo, f_cod e f_ctr=U, nesta
//   ordem, e levou cerca de 18 segundos;
// - a resposta é uma página com alert("O currículo foi enviado para
//   publicação."), que um fetch não roda;
// - depois, o menu mostra "Última publicação" do dia, sem o aviso de
//   pendência.
//
// Inferido, ainda sem teste no Lattes real:
// - que a tela de envio tenha controles com os mesmos nomes dos parâmetros
//   do GET (f_idioma, f_chk_en, f_email_contato, f_email_alternativo), de
//   onde o editor lê o que o Lattes tem;
// - que o texto da declaração seja o que está ao lado da caixa f_chk, e o
//   link do Termo de Uso, o link da tela com esse nome;
// - o que "status" falso e "existe" verdadeiro querem dizer (raça ou cor sem
//   preencher; e-mail já cadastrado em outro currículo). Nos dois casos o
//   conector para antes do envio e manda a pessoa à tela do Lattes, que sabe
//   o que pedir.
//
// A declaração é feita sob as penas da lei (arts. 297 a 299 do Código
// Penal). Só a pessoa a marca, a cada envio: nada aqui a marca, a lembra ou a
// presume. Sem `declarationAccepted === true`, vindo do clique dela no
// editor, o conector não envia nada.

import { scanForms } from '../census/html-scan.ts';
import { encodeLatin1Form, type Pairs } from './form.ts';
import { decodeHtmlEntities, plainText } from './html-text.ts';
import { cvCodeFrom, isLogonPage, lattesIdFrom, sameCv } from './lattes-html.ts';
import { lattesStatusFrom } from './lattes-status.ts';
import { readEmailReply, readRaceReply } from './publish-replies.ts';
import { type PublishStep, SEND_TIMEOUT_MS, timed } from './publish-steps.ts';
import { labelsFor, radioIdsOf, squash, termsText } from './send-screen-labels.ts';

export { readEmailReply, readRaceReply } from './publish-replies.ts';
export { localDay, publishBusy, publishMessage } from './publish-status.ts';
export { PUBLISH_PACE, type PublishStep, SEND_TIMEOUT_MS } from './publish-steps.ts';

/**
 * O envio exige a declaração marcada nesta tentativa e a releitura da tela.
 * Esta chave permite desligar o caminho inteiro, inclusive na extensão.
 * A sequência tem observação real (seção 10); a ativação no app ainda precisa
 * de validação acompanhada antes do lançamento.
 */
export const PUBLISH_ENABLED = true;

export interface PublishPort {
  /** GET de um caminho relativo a /cvlattesweb/; texto decodificado de Latin-1. */
  get(path: string, options?: { timeoutMs?: number }): Promise<{ html: string; url: string }>;
  /** POST de formulário (application/x-www-form-urlencoded). */
  post(path: string, body: string): Promise<{ html: string; url: string }>;
}

export interface ChoiceOption {
  label: string;
  value: string;
}

/**
 * O que a tela de envio do Lattes tem, lido sem enviar nada. Os campos
 * opcionais ficam undefined quando a tela não tem o controle; aí o editor
 * não envia (missingControls), porque mandaria um valor que não leu.
 */
export interface SendScreen {
  /**
   * A legenda da caixa da declaração ("Li e estou de acordo com a declaração
   * acima"), quando a tela a tem separada do texto.
   */
  agree?: string;
  /** O texto da declaração, como está na tela. */
  declaration: string;
  /** Os dois e-mails, como estão na tela; undefined quando a tela não tem o campo. */
  emailAlternative?: string;
  emailContact?: string;
  /** Autorização da versão em inglês (a caixa f_chk_en), quando a tela a tem. */
  english?: { checked: boolean; label: string; value: string };
  /** Idioma principal (f_idioma): as opções da própria tela e a marcada. */
  language?: { options: ChoiceOption[]; selected?: string };
  /** O endereço do Termo de Uso, como o link da tela aponta. */
  terms?: string;
}

/** O que a pessoa confirmou no editor para este envio. */
export interface PublishRequest {
  /**
   * A pessoa marcou a declaração neste envio. Só o clique dela põe true aqui;
   * qualquer outro valor recusa o envio.
   */
  declarationAccepted: boolean;
  /**
   * O texto da declaração que a pessoa leu quando marcou. Se a tela relida no
   * envio disser outra coisa, nada vai.
   */
  declarationText: string;
  emailAlternative: string;
  emailContact: string;
  /** Autoriza a versão em inglês. Só o que foi observado (sim) é enviado. */
  english: boolean;
  /** Valor de f_idioma, uma das opções da tela (ou "1", o observado). */
  language: string;
}

/** A mensagem atravessa JSON; a tipagem sozinha não valida o que chegou. */
export function isPublishRequest(value: unknown): value is PublishRequest {
  if (!value || typeof value !== 'object') return false;
  const request = value as Record<string, unknown>;
  return (
    typeof request.declarationAccepted === 'boolean' &&
    typeof request.english === 'boolean' &&
    ['declarationText', 'emailAlternative', 'emailContact', 'language'].every(
      (field) => typeof request[field] === 'string',
    )
  );
}

/** Por que o envio parou, ou "publicado" quando o menu confirmou. */
export type PublishOutcome =
  | 'consentimento'
  | 'declaracao'
  | 'desligado'
  | 'email'
  | 'erro'
  | 'mudou'
  | 'nada-a-publicar'
  | 'nao-confirmado'
  | 'outro-cv'
  | 'publicado'
  | 'raca-cor'
  | 'sem-aba'
  | 'sessao';

export interface PublishResult {
  detail?: string;
  /** Data da última publicação que o menu mostrou depois do envio (AAAA-MM-DD). */
  lastPublished?: string;
  outcome: PublishOutcome;
  /** O pedido de envio chegou a sair (o GET de pkg_publicar.enviar). */
  sent?: boolean;
  /** Quanto levou cada passo, em ms, na ordem: para o painel dizer onde o tempo foi. */
  steps?: PublishStep[];
}

/** O texto do alerta da resposta do envio (observado em 14/10/2026). */
export const SENT_ALERT = 'O currículo foi enviado para publicação.';

/** Valores do envio observado em 14/10/2026: português e versão em inglês autorizada. */
export const OBSERVED_LANGUAGE = '1';
export const OBSERVED_ENGLISH = '1';

/** A legenda da caixa na tela real: "Li e estou de acordo com a declaração acima". */
const AGREE = /^li e estou de acordo\b/i;

/** Um texto de declaração tão curto não é a declaração (é um "Sim", um rótulo solto). */
const MIN_DECLARATION = 20;

/** Resolve um href da tela contra o endereço dela; javascript: só vale com um endereço dentro. */
function resolveHref(href: string, pageUrl: string): string | undefined {
  let target = href.trim();
  if (/^javascript:/i.test(target)) {
    // Inferido: um link que abre o termo por script traz o endereço entre aspas.
    const inner =
      /['"]((?:https?:\/\/|\/)?[^'"\s]+\.(?:html?|pdf|jsp)(?:\?[^'"\s]*)?|https?:\/\/[^'"\s]+)['"]/i.exec(
        target,
      );
    if (!inner) return undefined;
    target = inner[1]!;
  }
  try {
    const url = new URL(target, pageUrl);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : undefined;
  } catch {
    return undefined;
  }
}

/** O link do Termo de Uso na tela (pelo texto do link). */
export function termsLink(html: string, pageUrl: string): string | undefined {
  for (const m of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a\s*>/gi)) {
    if (!/termo\s+de\s+uso/i.test(plainText(m[2] ?? ''))) continue;
    const href = /\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(m[1] ?? '');
    const raw = decodeHtmlEntities(href?.[1] ?? href?.[2] ?? href?.[3] ?? '');
    const url = raw && resolveHref(raw, pageUrl);
    if (url) return url;
  }
  return undefined;
}

/**
 * Lê a tela de envio (pkg_publicar.mostrar_cv). undefined quando não é ela:
 * sem o formulário "publicar" com a caixa f_chk, ou sem um texto de
 * declaração ao lado da caixa.
 */
export function readSendScreen(html: string, pageUrl: string): SendScreen | undefined {
  const { forms } = scanForms(html);
  const fields = forms.flatMap((f) => f.fields);
  const publicar = forms.find((f) => f.name.toLowerCase() === 'publicar');
  const chk = publicar?.fields.find((f) => f.name.toLowerCase() === 'f_chk');
  if (!chk) return undefined;
  // A declaração é o texto mais longo junto da caixa: na tela real (lida em
  // 21/10/2026) ela vem antes, e depois da caixa fica só a legenda "Li e estou
  // de acordo com a declaração acima". A legenda nunca passa por declaração:
  // sem outro texto, a tela não é a esperada e nada vai.
  // O link do Termo de Uso vem no fim do texto; o editor o mostra à parte.
  const link = termsText(html);
  const texts = [chk.label, chk.options?.[0]?.label ?? '']
    .map(squash)
    .map((t) => (link && t.endsWith(link) ? t.slice(0, -link.length).trim() : t));
  const declaration = texts
    .filter((t) => !AGREE.test(t))
    .sort((a, b) => b.length - a.length)
    .find((t) => t.length >= MIN_DECLARATION);
  if (!declaration) return undefined;
  const agree = texts.find((t) => t && t !== declaration);

  const byName = (name: string) => fields.find((f) => f.name.toLowerCase() === name);
  const language = byName('f_idioma');
  const english = byName('f_chk_en');
  const contact = byName('f_email_contato');
  const alternative = byName('f_email_alternativo');
  const englishOption = english?.options?.[0];
  // Os rádios do idioma têm o rótulo num <label for>, depois de cada um; o
  // texto antes deles é a pergunta da tela.
  const labelFor = labelsFor(html);
  const radioIds = radioIdsOf(html, 'f_idioma');
  return {
    ...(agree ? { agree } : {}),
    declaration,
    emailAlternative: alternative?.value,
    emailContact: contact?.value,
    english:
      english && englishOption
        ? {
            checked: englishOption.chosen,
            label: englishOption.label || english.label,
            value: englishOption.value,
          }
        : undefined,
    language: language?.options?.length
      ? {
          options: language.options.map((o) => ({
            label: labelFor.get(radioIds.get(o.value) ?? '') || o.label,
            value: o.value,
          })),
          selected: language.options.find((o) => o.chosen)?.value,
        }
      : undefined,
    terms: termsLink(html, pageUrl),
  };
}

/**
 * Os controles que o envio usa e a tela não mostrou. Que eles existam com os
 * nomes dos parâmetros do GET é inferido; sem algum deles, o editor não
 * envia, para não mandar um valor que não leu (um e-mail vazio por cima do
 * que o Lattes tem, a versão em inglês presumida).
 */
export function missingControls(screen: SendScreen): string[] {
  return [
    ...(screen.language ? [] : ['idioma principal']),
    ...(screen.english ? [] : ['versão em inglês']),
    ...(screen.emailContact === undefined ? ['e-mail de contato'] : []),
    ...(screen.emailAlternative === undefined ? ['e-mail alternativo'] : []),
  ];
}

/** O motivo de não poder enviar daqui com o que a tela tem e o que a pessoa escolheu. */
export function requestProblem(req: PublishRequest, screen?: SendScreen): string | undefined {
  if (!isPublishRequest(req))
    return 'O pedido de envio está incompleto ou tem um valor inválido. Nada foi enviado.';
  if (req.declarationAccepted !== true) {
    return 'Marque a declaração para enviar.';
  }
  if (!screen) return 'O editor não leu a tela de envio do Lattes.';
  if (req.declarationText !== screen.declaration) {
    return 'O texto da declaração no Lattes não é o que você marcou. Feche e abra este painel para ler de novo.';
  }
  const missing = missingControls(screen);
  if (missing.length) {
    return `A tela de envio do Lattes não tem ${missing.join(', ')} onde o editor espera; envie pelo Lattes.`;
  }
  if (!screen.terms) {
    return 'O editor não achou o link do Termo de Uso na tela de envio; envie pelo Lattes.';
  }
  if (!req.english) {
    return 'Enviar sem autorizar a versão em inglês ainda não foi observado; para isso, envie pela tela do Lattes.';
  }
  const languages = screen.language!.options.map((o) => o.value);
  if (!languages.includes(req.language)) return 'Escolha o idioma principal.';
  if (!req.emailContact.trim()) return 'Informe o e-mail de contato.';
  return undefined;
}

/** Os parâmetros do GET de envio, na ordem observada. */
export function sendPairs(code: string, req: PublishRequest): Pairs {
  return [
    ['f_chk', '1'],
    ['f_idioma', req.language],
    ['f_chk_en', OBSERVED_ENGLISH],
    ['f_email_contato', req.emailContact.trim()],
    ['f_email_alternativo', req.emailAlternative.trim()],
    ['f_cod', code],
    ['f_ctr', 'U'],
  ];
}

/** O menu confirma a publicação: "Última publicação" de hoje e nenhum aviso de pendência. */
export function publishedOn(menuHtml: string, today: string): boolean {
  const status = lattesStatusFrom(menuHtml);
  return Boolean(status && status.lastPublished === today && !status.pending);
}

export interface PublishOptions {
  /** A chave (PUBLISH_ENABLED); só os testes passam outro valor. */
  enabled?: boolean;
  /** Identificador do currículo aberto no editor, conferido no menu atual. */
  expectedLattesId?: string;
  /** O relógio dos tempos de cada passo (os testes passam outro). */
  now?: () => number;
  /** AAAA-MM-DD de hoje, no fuso da pessoa (o do Lattes). */
  today: string;
  /** Quantas vezes reler o menu depois do envio, e quanto esperar entre elas. */
  verifyAttempts?: number;
  verifyDelayMs?: number;
  wait?: (ms: number) => Promise<void>;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** A tela de envio, lida por GET: o que o editor mostra antes de a pessoa enviar. */
export async function readSendScreenFrom(
  port: PublishPort,
  code: string | undefined,
): Promise<{ detail?: string; reason?: 'erro' | 'mudou' | 'sessao'; screen?: SendScreen }> {
  if (!code)
    return { detail: 'Não achei o código do currículo no menu do Lattes.', reason: 'erro' };
  const page = await port.get(`pkg_publicar.mostrar_cv?f_cod=${code}`);
  if (isLogonPage(page.html, page.url)) return { reason: 'sessao' };
  const screen = readSendScreen(page.html, page.url);
  if (!screen) {
    return {
      detail: 'A tela de envio do Lattes não tem a declaração onde o editor espera.',
      reason: 'mudou',
    };
  }
  const missing = missingControls(screen);
  if (missing.length) {
    return {
      detail: `A tela de envio do Lattes não tem ${missing.join(', ')} onde o editor espera.`,
      reason: 'mudou',
    };
  }
  return { screen };
}

/**
 * Envia ao CNPq como a tela do Lattes faz e confere pelo menu. Antes de
 * qualquer pedido, a declaração tem de ter sido marcada pela pessoa; depois
 * de reler a tela, as duas consultas da página; só então o envio. A resposta
 * do envio não conta como prova: o que vale é o menu.
 */
export async function publishCv(
  port: PublishPort,
  code: string | undefined,
  req: PublishRequest,
  options: PublishOptions,
): Promise<PublishResult> {
  const steps: PublishStep[] = [];
  const t = timed(port, options.wait ?? sleep, options.now ?? Date.now, steps);
  const result = await publishSteps(t.port, code, req, { ...options, wait: t.wait });
  return steps.length > 0 ? { ...result, steps } : result;
}

async function publishSteps(
  port: PublishPort,
  code: string | undefined,
  req: PublishRequest,
  options: PublishOptions,
): Promise<PublishResult> {
  if (!(options.enabled ?? PUBLISH_ENABLED)) {
    return { detail: 'O envio ao CNPq pelo editor está desligado.', outcome: 'desligado' };
  }
  if (!isPublishRequest(req)) {
    return {
      detail: 'O pedido de envio está incompleto ou tem um valor inválido. Nada foi enviado.',
      outcome: 'erro',
    };
  }
  if (req.declarationAccepted !== true) {
    return { detail: 'A declaração não foi marcada; nada foi enviado.', outcome: 'declaracao' };
  }
  // Antes de tudo, o menu: sem o aviso de pendência, não há o que publicar, e
  // um envio repetido (depois de um resultado incerto) para aqui.
  const menuBefore = await port.get('PKG_MENU.menu');
  if (isLogonPage(menuBefore.html, menuBefore.url)) return { outcome: 'sessao' };
  const before = lattesStatusFrom(menuBefore.html);
  if (!before) {
    return {
      detail: 'O menu do Lattes não mostrou a data da última publicação.',
      outcome: 'mudou',
    };
  }
  // O DOM da aba pode ser de uma sessão anterior. O identificador do menu
  // atual confirma o currículo; f_cod sozinho não substitui essa identidade.
  const menuCode = cvCodeFrom(menuBefore.html);
  const wrongCv = options.expectedLattesId
    ? !sameCv(options.expectedLattesId, lattesIdFrom(menuBefore.html))
    : !!code && menuCode !== code;
  if (wrongCv) {
    return {
      detail:
        'O menu atual do Lattes não corresponde à sessão conferida. Reabra o painel antes de enviar.',
      outcome: 'outro-cv',
    };
  }
  const currentCode = options.expectedLattesId && code ? menuCode : code;
  if (!before.pending) {
    return {
      detail: 'O menu do Lattes não tem o aviso de alterações não enviadas: não há o que publicar.',
      lastPublished: before.lastPublished,
      outcome: 'nada-a-publicar',
    };
  }
  const read = await readSendScreenFrom(port, currentCode);
  if (!read.screen) {
    return {
      detail: read.detail,
      outcome: read.reason === 'sessao' ? 'sessao' : (read.reason ?? 'erro'),
    };
  }
  const problem = requestProblem(req, read.screen);
  if (problem) {
    const changed = req.declarationText !== read.screen.declaration;
    return { detail: problem, outcome: changed ? 'mudou' : 'erro' };
  }
  const cod = currentCode!;

  const race = await port.post(
    'pkg_publicar.racapreenchida_raca_cor',
    encodeLatin1Form([['f_cod', cod]]),
  );
  if (isLogonPage(race.html, race.url)) return { outcome: 'sessao' };
  const raceOk = readRaceReply(race.html);
  if (raceOk !== true) {
    return {
      detail:
        raceOk === false
          ? 'O Lattes respondeu que falta algo antes de publicar (a consulta de raça ou cor). Abra "Enviar" no Lattes para ver o que ele pede.'
          : 'O Lattes respondeu a consulta de raça ou cor de um jeito que o editor não conhece. Nada foi enviado.',
      outcome: raceOk === false ? 'raca-cor' : 'mudou',
    };
  }

  for (const email of [req.emailContact.trim(), req.emailAlternative.trim()]) {
    const res = await port.post(
      'pkg_util.existe_email_cadastrado',
      encodeLatin1Form([
        ['f_email', email],
        ['f_cod', cod],
      ]),
    );
    if (isLogonPage(res.html, res.url)) return { outcome: 'sessao' };
    const reply = readEmailReply(res.html);
    if (!reply) {
      return {
        detail:
          'O Lattes respondeu a consulta de e-mail de um jeito que o editor não conhece. Nada foi enviado.',
        outcome: 'mudou',
      };
    }
    if (reply.exists) {
      return {
        detail: `O Lattes respondeu sobre o e-mail ${email || '(vazio)'}: ${reply.message ?? 'já cadastrado'}. Abra "Enviar" no Lattes para ver o que ele pede.`,
        outcome: 'email',
      };
    }
  }

  let answered = false;
  try {
    const sent = await port.get(`pkg_publicar.enviar?${encodeLatin1Form(sendPairs(cod, req))}`, {
      timeoutMs: SEND_TIMEOUT_MS,
    });
    answered = sent.html.includes(SENT_ALERT);
  } catch {
    // A resposta perdida não diz se o CNPq recebeu o pedido. Só o menu é
    // relido; o GET de envio nunca é repetido nesta tentativa.
  }
  // O alerta da resposta não prova nada; a sessão caída na resposta também
  // não diz se o envio entrou. Nos dois casos, quem responde é o menu.
  const wait = options.wait ?? sleep;
  const attempts = options.verifyAttempts ?? 4;
  let menu = '';
  for (let i = 0; i < attempts; i++) {
    if (i > 0) await wait(options.verifyDelayMs ?? 3000);
    let res: Awaited<ReturnType<PublishPort['get']>>;
    try {
      res = await port.get('PKG_MENU.menu');
    } catch {
      // Uma leitura perdida ainda pode ser conferida nas tentativas restantes.
      continue;
    }
    if (isLogonPage(res.html, res.url)) {
      return {
        detail:
          'A sessão do Lattes caiu depois do envio. Entre de novo e confira a "Última publicação" no menu.',
        outcome: 'sessao',
        sent: true,
      };
    }
    menu = res.html;
    // Só conta a passagem: havia pendência antes do envio (conferido acima) e
    // agora não há, com a publicação de hoje. Uma publicação de mais cedo no
    // mesmo dia, com a pendência ainda acesa, não é sucesso.
    if (publishedOn(menu, options.today)) {
      return { lastPublished: options.today, outcome: 'publicado', sent: true };
    }
  }
  const status = lattesStatusFrom(menu);
  return {
    detail: [
      answered
        ? 'O Lattes respondeu que o currículo foi enviado'
        : 'O Lattes não respondeu como no envio observado',
      status?.lastPublished
        ? `, mas o menu ainda mostra a última publicação em ${status.lastPublished.split('-').reverse().join('/')}`
        : ', e o menu não mostrou a data da última publicação',
      status?.pending ? ' e o aviso de alterações não enviadas' : '',
      '. Confira no Lattes antes de enviar de novo.',
    ].join(''),
    lastPublished: status?.lastPublished,
    outcome: 'nao-confirmado',
    sent: true,
  };
}
