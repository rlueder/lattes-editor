// O contrato da conector: os links do menu, os formulários e os
// campos que o conector espera encontrar, como foram lidos no Lattes
// (docs/lattes_internals.md, seção 5). O CNPq não publica roadmap nem
// changelog, então a única maneira de saber que algo mudou é olhar.
//
// A verificação só lê (GET), nunca grava, e a impressão digital de um
// formulário guarda nomes, tipos e limites dos campos, nunca valores: o
// relatório pode ser colado numa issue pública sem expor o currículo.

import type { LattesPort } from './apply.ts';
import {
  biographicContract,
  type BiographicKind,
  biographicSample,
  isBiographicKind,
} from './biographic.ts';
import { CREATE_ITEMS_ENABLED } from './create.ts';
import { CREATE_SPECS, createFormPath } from './create-items.ts';
import { contractKind, type DeleteOp } from './delete.ts';
import { editContract, eventoSample } from './edit-items.ts';
import type { FormControl } from './form.ts';
import { cvCodeFrom, findLinks, isLogonPage } from './lattes-html.ts';
import {
  checkLists,
  checkSources,
  type ListCheck,
  unreadLists,
  unreadSources,
} from './list-watch.ts';
import type { BridgeOp } from './plan.ts';

// O texto do relatório mora em contract-report.ts; quem já importava daqui segue igual.
export { driftText, ISSUES_URL, issueUrl, reportText } from './contract-report.ts';

export interface FieldSpec {
  /** Limite do campo (maxlength) quando o HTML declara. */
  maxLength?: number;
  /** Tipo como o navegador o vê: text, textarea, checkbox, radio, select-one, hidden. */
  type: string;
}

export interface FormSpec {
  /** Procedimento do POST. */
  action: string;
  fields: Record<string, FieldSpec>;
  /** Valor de f_ctr esperado: U na alteração (padrão), I na inclusão. */
  mode?: string;
  /** Atributo name do <form>. */
  name: string;
  /**
   * Só os campos listados são conferidos: o mapa não registrou o tipo de todos
   * (formulários de inclusão de formação e projeto). Campo a mais não é mudança.
   */
  partial?: boolean;
}

type CreateKind =
  | 'criar-atividade'
  | 'criar-atuacao'
  | 'criar-dado'
  | 'criar-evento'
  | 'criar-formacao'
  | 'criar-projeto'
  | 'criar-registro'
  | 'criar-vinculo';

/**
 * Formulários fora do contrato fixo: os que só entram com a chave ligada
 * (create.ts, create-items.ts, biographic.ts, edit-items.ts) e a exclusão, que não tem
 * formulário próprio (delete.ts usa o de edição e a conferência dele).
 */
type GatedKind = CreateKind | 'evento' | BiographicKind | DeleteOp['kind'];

export interface Contract {
  /**
   * A inclusão só entra com CREATE_ITEMS_ENABLED; os dados gerais, com
   * BIOGRAPHIC_OPS_ENABLED; os eventos, com EDIT_OUVINTE_ENABLED.
   */
  forms: Omit<Record<BridgeOp['kind'], FormSpec>, GatedKind> & Partial<Record<GatedKind, FormSpec>>;
  /** Procedimentos que precisam estar linkados no menu do currículo. */
  menu: string[];
}

const text = (maxLength: number): FieldSpec => ({ maxLength, type: 'text' });
const textarea = (maxLength: number): FieldSpec => ({ maxLength, type: 'textarea' });
const hidden: FieldSpec = { type: 'hidden' };
const select: FieldSpec = { type: 'select-one' };
const checkbox: FieldSpec = { type: 'checkbox' };
const radio: FieldSpec = { type: 'radio' };

/**
 * O que o conector viu no Lattes em 11/10/2026. Os limites vêm das tabelas de
 * docs/lattes_internals.md; um campo sem limite ali fica sem limite aqui.
 * Quando o Lattes mudar, a verificação aponta o campo e este contrato é
 * atualizado junto com o código que depende dele.
 */
export const LATTES_CONTRACT: Contract = {
  forms: {
    ...(CREATE_ITEMS_ENABLED ? CREATE_SPECS : {}),
    ...biographicContract().forms,
    ...editContract().forms,
    idioma: {
      action: 'PKG_IDIOMA.FORM',
      fields: {
        f_cod: hidden,
        F_COD_IDIOMA: select,
        F_COMPR: radio,
        F_CONVERSA: radio,
        f_ctr: hidden,
        F_ESCREVE: radio,
        F_LE: radio,
        f_seq: hidden,
        f_tipo_privacidade: select,
        FC_COMPR: checkbox,
        FC_CONVERSA: checkbox,
        FC_ESCREVE: checkbox,
        FC_LE: checkbox,
      },
      name: 'GN_IDIOMA',
    },
    resumo: {
      action: 'PKG_RESUME.FORM',
      fields: {
        f_cod: hidden,
        f_ctr: hidden,
        f_resume_auto: hidden,
        f_resume_auto_en: hidden,
        f_ret: hidden,
        F_TEXTO: textarea(4000),
        F_TEXTO_EN: textarea(4000),
      },
      name: 'RES',
    },
    vinculo: {
      action: 'PKG_ATIV.VINCULOS',
      fields: {
        f_ano_fim: text(4),
        f_ano_ini: text(4),
        f_carga: text(3),
        f_cod: hidden,
        f_codinst: hidden,
        f_ctr: hidden,
        f_enqua: text(45),
        f_enqua_en: text(45),
        f_mes_fim: text(2),
        f_mes_ini: text(2),
        f_outras_inf: textarea(3950),
        f_outras_inf_en: textarea(2000),
        f_regime: checkbox,
        f_seq_ativ: hidden,
        f_seq_hist: hidden,
        f_status: radio,
        f_stavinc: select,
        f_tipo_privacidade: select,
        f_vinc: text(30),
        f_vinculo: hidden,
      },
      name: 'GN_ATIV_VINC',
    },
  },
  menu: [
    'pkg_ativ.lista',
    'pkg_idioma.lista',
    'pkg_resume.',
    ...biographicContract().menu,
    ...editContract().menu,
  ],
};

export type Fingerprint = Record<string, FieldSpec>;

/**
 * Impressão digital de um formulário: nome, tipo e limite de cada campo. Os
 * rádios de um mesmo nome viram uma entrada só. Botões não contam. Nenhum
 * valor entra aqui.
 */
export function fingerprint(controls: FormControl[]): Fingerprint {
  const out: Fingerprint = {};
  for (const c of controls) {
    if (!c.name || c.type === 'button' || c.type === 'submit' || c.type === 'reset') continue;
    if (c.name in out) continue;
    out[c.name] = c.maxLength ? { maxLength: c.maxLength, type: c.type } : { type: c.type };
  }
  return out;
}

export type DriftKind =
  | 'campo-novo'
  | 'campo-sumiu'
  | 'formulario-sumiu'
  | 'limite-mudou'
  | 'link-sumiu'
  | 'modo-mudou'
  | 'tipo-mudou';

export interface Drift {
  expected?: string;
  field: string;
  form: string;
  kind: DriftKind;
  observed?: string;
}

/** Mudanças que quebram o conector; as outras só avisam. */
const BREAKING: ReadonlySet<DriftKind> = new Set([
  'campo-sumiu',
  'formulario-sumiu',
  'link-sumiu',
  'modo-mudou',
  'tipo-mudou',
]);

export function isBreaking(drift: Drift): boolean {
  return BREAKING.has(drift.kind);
}

/** Compara a impressão digital lida com a esperada; um Drift por diferença. */
export function compareForm(
  form: string,
  expected: Record<string, FieldSpec>,
  observed: Fingerprint,
  partial = false,
): Drift[] {
  const drifts: Drift[] = [];
  for (const [field, spec] of Object.entries(expected)) {
    const seen = observed[field];
    if (!seen) {
      drifts.push({ field, form, kind: 'campo-sumiu' });
      continue;
    }
    if (seen.type !== spec.type) {
      drifts.push({ expected: spec.type, field, form, kind: 'tipo-mudou', observed: seen.type });
    }
    if (spec.maxLength && seen.maxLength && seen.maxLength !== spec.maxLength) {
      drifts.push({
        expected: String(spec.maxLength),
        field,
        form,
        kind: 'limite-mudou',
        observed: String(seen.maxLength),
      });
    }
  }
  if (partial) return drifts;
  for (const field of Object.keys(observed)) {
    if (!(field in expected)) drifts.push({ field, form, kind: 'campo-novo' });
  }
  return drifts;
}

export type FormStatus = 'mudou' | 'nao-encontrado' | 'ok' | 'sem-amostra';

export interface FormCheck {
  /** Por que não deu para conferir, quando não deu. */
  detail?: string;
  drifts: Drift[];
  form: string;
  kind: BridgeOp['kind'];
  status: FormStatus;
}

export type ReportStatus = 'erro' | 'mudou' | 'ok' | 'sessao';

export interface ContractReport {
  /** ISO 8601, no momento da verificação. */
  checkedAt: string;
  detail?: string;
  forms: FormCheck[];
  /** As listas dos campos tipados (list-watch.ts); ausente em relatórios de antes delas. */
  lists?: ListCheck[];
  menu: { found: boolean; proc: string }[];
  status: ReportStatus;
}

/** Com o Lattes como esperado, a verificação automática se repete a cada meia hora. */
export const AUTO_VERIFY_EVERY_MS = 30 * 60_000;

/** Com problema, de novo a cada vez que o Lattes carrega, no máximo uma vez por minuto. */
export const AUTO_VERIFY_RETRY_MS = 60_000;

/**
 * Espera antes da verificação automática. Logo depois de o menu carregar (ou
 * do painel abrir junto com ele), a primeira verificação falhava e a manual,
 * segundos depois, passava (observado em 13/10/2026).
 */
export const AUTO_VERIFY_DELAY_MS = 3000;

/** Na verificação automática, uma falha de leitura tenta de novo depois disto. */
export const AUTO_VERIFY_RETRY_DELAY_MS = 5000;

/**
 * Se o resultado da verificação automática merece uma segunda tentativa antes
 * de aparecer no painel: leitura que falhou ou sessão que pareceu caída, que
 * podem ser a aba ainda terminando de carregar. Mudança no contrato, não.
 */
export function retryAutoVerify(report: ContractReport): boolean {
  return report.status === 'erro' || report.status === 'sessao';
}

/**
 * Se a verificação automática (painel aberto, menu do Lattes carregado) deve
 * rodar agora. Ela lê o menu e um exemplar de cada formulário: com tudo certo,
 * não precisa repetir a cada página.
 */
export function shouldAutoVerify(report: ContractReport | undefined, now: number): boolean {
  if (!report) return true;
  const age = now - Date.parse(report.checkedAt);
  if (!Number.isFinite(age)) return true;
  return age >= (report.status === 'ok' ? AUTO_VERIFY_EVERY_MS : AUTO_VERIFY_RETRY_MS);
}

class Stop extends Error {
  status: ReportStatus;
  constructor(status: ReportStatus, detail: string) {
    super(detail);
    this.status = status;
  }
}

async function getChecked(port: LattesPort, path: string): Promise<string> {
  const html = await port.get(path);
  if (isLogonPage(html, path))
    throw new Stop('sessao', 'A sessão do Lattes expirou; entre de novo');
  return html;
}

/** Lê o formulário no caminho e o compara com a especificação. */
async function checkForm(
  port: LattesPort,
  kind: BridgeOp['kind'],
  spec: FormSpec,
  path: string,
): Promise<FormCheck> {
  const html = await getChecked(port, path);
  const controls = port.readForm(html, spec.name);
  if (!controls) {
    return {
      drifts: [{ field: '', form: spec.name, kind: 'formulario-sumiu' }],
      form: spec.name,
      kind,
      status: 'mudou',
    };
  }
  const drifts = compareForm(spec.name, spec.fields, fingerprint(controls), spec.partial);
  // O conector só grava em modo de alteração; o valor de controle não é pessoal.
  const ctr = controls.find((c) => c.name === 'f_ctr')?.value;
  const mode = spec.mode ?? 'U';
  if (ctr !== undefined && ctr !== mode) {
    drifts.push({
      expected: mode,
      field: 'f_ctr',
      form: spec.name,
      kind: 'modo-mudou',
      observed: ctr,
    });
  }
  return { drifts, form: spec.name, kind, status: drifts.length ? 'mudou' : 'ok' };
}

const noSample = (kind: BridgeOp['kind'], form: string, detail: string): FormCheck => ({
  detail,
  drifts: [],
  form,
  kind,
  status: 'sem-amostra',
});

const noLink = (kind: BridgeOp['kind'], form: string, proc: string): FormCheck => ({
  drifts: [{ field: proc, form, kind: 'link-sumiu' }],
  form,
  kind,
  status: 'nao-encontrado',
});

/** Mesmos caminhos que apply.ts percorre para achar cada formulário, só lendo. */
async function locateAndCheck(
  port: LattesPort,
  kind: BridgeOp['kind'],
  spec: FormSpec,
  menu: string,
): Promise<FormCheck> {
  if (kind === 'resumo') {
    const link = findLinks(menu, 'pkg_resume.')[0];
    return link ? checkForm(port, kind, spec, link.path) : noLink(kind, spec.name, 'pkg_resume.');
  }
  if (
    kind === 'criar-formacao' ||
    kind === 'criar-projeto' ||
    kind === 'criar-registro' ||
    kind === 'criar-atividade' ||
    kind === 'criar-dado' ||
    kind === 'criar-evento' ||
    kind === 'criar-vinculo'
  ) {
    // Formulários de inclusão: abrem vazios, não precisam de amostra.
    const found = await createFormPath(kind, (path) => getChecked(port, path), menu);
    return 'path' in found
      ? checkForm(port, kind, spec, found.path)
      : noLink(kind, spec.name, found.missing);
  }
  if (kind === 'evento' || isBiographicKind(kind)) {
    const found = isBiographicKind(kind)
      ? await biographicSample(kind, menu, (path) => getChecked(port, path))
      : await eventoSample(menu, (path) => getChecked(port, path));
    if ('path' in found) return checkForm(port, kind, spec, found.path);
    return 'link' in found
      ? noLink(kind, spec.name, found.link)
      : noSample(kind, spec.name, found.none);
  }
  if (kind === 'criar-atuacao') {
    // O formulário de inclusão abre vazio: não precisa de amostra.
    const lista = findLinks(menu, 'pkg_ativ.lista')[0];
    if (!lista) return noLink(kind, spec.name, 'pkg_ativ.lista');
    const inclui = findLinks(await getChecked(port, lista.path), 'pkg_ativ.inclui')[0];
    return inclui
      ? checkForm(port, kind, spec, inclui.path)
      : noLink(kind, spec.name, 'pkg_ativ.inclui');
  }
  if (kind === 'idioma') {
    const lista = findLinks(menu, 'pkg_idioma.lista')[0];
    if (!lista) return noLink(kind, spec.name, 'pkg_idioma.lista');
    const listaHtml = await getChecked(port, lista.path);
    const form = findLinks(listaHtml, 'pkg_idioma.form').find((l) => l.params.f_seq);
    if (!form) return noSample(kind, spec.name, 'O currículo não tem idioma cadastrado');
    return checkForm(port, kind, spec, form.path);
  }
  const lista = findLinks(menu, 'pkg_ativ.lista')[0];
  if (!lista) return noLink(kind, spec.name, 'pkg_ativ.lista');
  const listaHtml = await getChecked(port, lista.path);
  const grids = findLinks(listaHtml, 'pkg_ativ.cargos_vinculos');
  if (grids.length === 0)
    return noSample(kind, spec.name, 'O currículo não tem atuação profissional');
  // Nem toda atuação tem vínculo; a amostra é o primeiro que existir.
  for (const grid of grids) {
    const gridHtml = await getChecked(port, grid.path);
    const vinculo = findLinks(gridHtml, 'pkg_ativ.vinculos').find((l) => l.params.f_seq_hist);
    if (vinculo) return checkForm(port, kind, spec, vinculo.path);
  }
  return noSample(kind, spec.name, 'Nenhuma atuação tem vínculo');
}

/**
 * Confere o Lattes contra o contrato, só com leituras: os links do menu e um
 * exemplar de cada formulário que o conector grava. Sem exemplar (currículo sem
 * idioma, sem atuação), o formulário fica "sem amostra", que não é erro.
 */
export async function checkContract(
  port: LattesPort,
  contract: Contract = LATTES_CONTRACT,
): Promise<ContractReport> {
  const checkedAt = new Date().toISOString();
  try {
    const menu = await port.menuHtml();
    if (isLogonPage(menu)) throw new Stop('sessao', 'A sessão do Lattes expirou; entre de novo');
    const menuChecks = contract.menu.map((proc) => ({
      found: findLinks(menu, proc).length > 0,
      proc,
    }));
    const forms: FormCheck[] = [];
    for (const [kind, spec] of Object.entries(contract.forms) as [BridgeOp['kind'], FormSpec][]) {
      forms.push(await locateAndCheck(port, kind, spec, menu));
    }
    // As listas dos campos tipados (list-watch.ts), pelo código do currículo do
    // menu. Menu sem o código também é mudança do Lattes: as listas ficam como
    // não lidas, em vez de passar sem conferir.
    // As fontes das listas lidas ao vivo (área, agência) entram junto.
    const code = cvCodeFrom(menu);
    const listPort = {
      get: (path: string) => getChecked(port, path),
      isFatal: (err: unknown) => err instanceof Stop,
    };
    const lists = code
      ? [...(await checkLists(listPort, code)), ...(await checkSources(listPort, code, menu))]
      : [
          ...unreadLists('O código do currículo não está no menu'),
          ...unreadSources('O código do currículo não está no menu'),
        ];
    const changed =
      forms.some((f) => f.drifts.length > 0) ||
      menuChecks.some((m) => !m.found) ||
      lists.some((l) => l.status !== 'ok');
    return { checkedAt, forms, lists, menu: menuChecks, status: changed ? 'mudou' : 'ok' };
  } catch (err) {
    if (err instanceof Stop)
      return { checkedAt, detail: err.message, forms: [], menu: [], status: err.status };
    return {
      checkedAt,
      detail: err instanceof Error ? err.message : 'Falha inesperada',
      forms: [],
      menu: [],
      status: 'erro',
    };
  }
}

/** O relatório impede gravar nesse formulário? Só as mudanças que quebram o conector. */
export function blocksKind(report: ContractReport | undefined, kind: BridgeOp['kind']): Drift[] {
  if (!report || report.status !== 'mudou') return [];
  const form = report.forms.find((f) => f.kind === contractKind(kind));
  return form ? form.drifts.filter(isBreaking) : [];
}

/**
 * O relatório não conferiu esse formulário por falta de exemplar? O conector só
 * altera registros que já existem, então uma fila com esse tipo de operação e
 * um Lattes sem exemplar dele é contradição: ou o currículo aberto é outro,
 * ou o caminho até o formulário mudou. Sem conferir, não se grava.
 */
export function lacksSample(
  report: ContractReport | undefined,
  kind: BridgeOp['kind'],
): FormCheck | undefined {
  if (!report || (report.status !== 'ok' && report.status !== 'mudou')) return undefined;
  return report.forms.find((f) => f.kind === contractKind(kind) && f.status === 'sem-amostra');
}
