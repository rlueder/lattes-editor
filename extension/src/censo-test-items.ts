// Os itens de teste da passada completa, rodados pela pessoa na aba do menu
// do Lattes (docs/lattes-formularios/itens-de-teste.md). Cada chamada cria
// ou remove um lote pequeno, com pausa entre um envio e outro, e guarda o
// andamento neste navegador para a chamada seguinte continuar dali.
//
// O formulário de cada item abre num quadro dentro da própria página, e é a
// página que valida e envia (check() e enviar()), como quando a pessoa clica
// em "Salvar". As mensagens que ela mostraria na caixa do Lattes voltam no
// resultado em vez de aparecer na tela.

import { TEST_BATCH_LIMIT, testBatchSize } from './censo-batch.ts';
import { frameState, openFrame } from './censo-frame.ts';
import { type FrameWindow, submit } from './censo-submit.ts';
import { censusTraffic } from './censo-traffic.ts';
export { openFrame } from './censo-frame.ts';
export { type FrameWindow, submit } from './censo-submit.ts';

import { isEspelhoPage } from '../../src/bridge/espelho.ts';
import type { PlacedRow } from '../../src/census/test-ledger.ts';
import {
  consistencyFixes,
  pickOption,
  type TestJob,
  textValue,
} from '../../src/census/test-plan.ts';
import {
  context,
  ensureContext,
  placed,
  PLACELESS,
  projectFields,
  setFields,
} from './censo-test-donors.ts';
import { clearBase, ledgerNow, loadBase } from './censo-test-ledger.ts';
import { pageValues } from './censo-test-pages.ts';

export interface TestResult {
  id: string;
  msgs: string[];
  ok: boolean;
  tag: string;
  /** Um envio pode ter chegado ao servidor, mas não foi confirmado. */
  uncertain?: boolean;
  values: Record<string, string>;
  variant: number;
}

export interface BatchOptions {
  /** Itens por chamada, de 1 a 3 (padrão 3). */
  batch?: number;
  /** Tags cuja ausência a pessoa conferiu no Lattes antes de pedir nova tentativa. */
  confirmedAbsent?: string[];
  /** Tags cuja presença e conteúdo a pessoa conferiu no Lattes. */
  confirmedPresent?: string[];
  /** Pausa entre um envio e outro, sorteada entre os dois (padrão 3 a 6 s). */
  delayMs?: [number, number];
  /**
   * O projeto de teste na atuação desta instituição (código com a letra, como
   * a janela de instituições o mostra) e, com organ, com o primeiro órgão dela.
   */
  project?: { institution: string; organ?: boolean };
  /** Endereço que recebe os resultados por POST, além do armazenamento local. */
  receiver?: string;
  /** Tenta de novo os que falharam (depois de ajustar o que faltava). */
  retryFailed?: boolean;
  /** Só estes tipos (o id do censo: orientacao-concluida, banca-julgadora...). */
  only?: string[];
}

const STORE = 'lattes-editor:itens-de-teste';

/** O que a passada está fazendo agora, para o editor mostrar enquanto espera. */
export interface LiveProgress {
  at: number;
  /** Itens (ou páginas, na leitura) já feitos nesta chamada. */
  done: number;
  last?: string;
  phase: 'criando' | 'lendo' | 'parado' | 'removendo';
  total?: number;
}

export function setLive(patch: Partial<LiveProgress>): void {
  const g = globalThis as unknown as { __lattesTestLive?: LiveProgress };
  g.__lattesTestLive = {
    done: 0,
    phase: 'parado',
    ...g.__lattesTestLive,
    ...patch,
    at: Date.now(),
  };
}

export function live(): LiveProgress | undefined {
  return (globalThis as unknown as { __lattesTestLive?: LiveProgress }).__lattesTestLive;
}

interface Progress {
  /** O que as listas têm a mais que a base (o registro da Fase 0). */
  added?: PlacedRow[];
  /** O que sumiu da base: não pode acontecer, e aparece no resumo. */
  missing?: PlacedRow[];
  pendingRemovals?: string[];
  removed: string[];
  results: TestResult[];
}

export function load(): Progress {
  try {
    const raw = localStorage.getItem(STORE);
    if (raw) {
      const value = JSON.parse(raw) as Progress;
      if (
        !value ||
        !Array.isArray(value.results) ||
        !Array.isArray(value.removed) ||
        !value.results.every((r) => r && typeof r.tag === 'string' && typeof r.ok === 'boolean') ||
        (value.pendingRemovals !== undefined && !Array.isArray(value.pendingRemovals))
      )
        throw new Error('Registro de teste inválido');
      return value;
    }
  } catch {
    throw new Error('O registro dos itens de teste não pôde ser lido; nenhum envio será iniciado');
  }
  return { removed: [], results: [] };
}

export function save(p: Progress): void {
  try {
    localStorage.setItem(STORE, JSON.stringify(p));
  } catch {
    throw new Error(
      'O registro dos itens de teste não pôde ser salvo; nenhum novo envio será iniciado',
    );
  }
}

export const pause = ([min, max]: [number, number]) =>
  censusTraffic.wait(min + Math.random() * (max - min));

/** A sua linha na grade de autores (o check() exige), copiada do autorDP do menu. */
function addOwner(w: FrameWindow): void {
  const owner = (window as unknown as { autorDP?: Record<string, string>[] }).autorDP?.find(
    (r) => !r.c,
  );
  const grid = w.autorGrid?.getProvider();
  if (!owner || !grid) return;
  // Na equipe de um projeto, a coluna tit marca o coordenador (s).
  const team = !!w.document.forms.namedItem('GN_PROJETO');
  const row = Object.fromEntries([
    ['l', owner.l],
    ['c', ''],
    ['t', owner.t],
    ...(team ? [['tit', 's']] : []),
    ['editable', false],
    ['deletable', true],
  ]);
  if (grid.length && Object.keys(grid[0]!).length === 0) grid.splice(0, 0, row);
  else grid.unshift(row);
}

type Field = HTMLInputElement & HTMLSelectElement & HTMLTextAreaElement;

/** Campo com nome e habilitado. O quadro é de outro documento: nada de instanceof. */
const editable = (el: Element): el is Field => !!(el as Field).name && !(el as Field).disabled;
const isInput = (el: Field, ...types: string[]) =>
  el.tagName === 'INPUT' && types.includes(el.type);

/** Rádios primeiro (eles trocam opções e habilitam campos), depois escolhas e textos. */
function fill(w: FrameWindow, form: HTMLFormElement, job: TestJob): Record<string, string> {
  const values: Record<string, string> = {};
  const fields = () => [...form.elements].filter(editable);
  const groups = new Map<string, Field[]>();
  for (const el of fields()) {
    if (isInput(el, 'radio')) groups.set(el.name, [...(groups.get(el.name) ?? []), el]);
  }
  for (const [name, group] of groups) {
    const chosen = group[job.variant % group.length]!;
    chosen.click();
    values[name] = chosen.value;
  }
  for (const el of fields()) {
    if (el.name === 'f_tipo_privacidade') continue;
    if (isInput(el, 'checkbox')) {
      // Num grupo de caixas, a primeira sempre marcada (o check() pede uma).
      const group = fields().filter((x) => isInput(x, 'checkbox') && x.name === el.name);
      const first = group.length > 1 && group[0] === el;
      if (!el.checked && (first || job.variant % 2 === 0)) el.click();
      values[el.name] = el.checked ? el.value || 'on' : '';
    } else if (el.tagName === 'SELECT' && el.type === 'select-one') {
      const opts = [...el.options].map((o) => ({ text: o.text, value: o.value }));
      // O vínculo da atuação sai da janela da página (pageValues).
      if (el.name === 'f_stavinc') continue;
      const pick = pickOption(el.name, opts, job.variant);
      if (!pick) continue;
      el.value = pick.value;
      el.dispatchEvent(new (w as unknown as typeof globalThis).Event('change', { bubbles: true }));
      values[el.name] = pick.value;
    }
  }
  for (const el of fields()) {
    const text = el.tagName === 'TEXTAREA' || isInput(el, '', 'text', 'email', 'url', 'number');
    // A privacidade vira um campo de texto do ms-dropdown com o mesmo nome.
    if (!text || el.readOnly || el.name === 'f_tipo_privacidade') continue;
    el.value = textValue(el.name, el.maxLength, job.variant, job.tag);
    values[el.name] = el.value;
  }
  const own = context.donors[job.form];
  const donor = own && !PLACELESS.test(job.path) ? own : anyDonor();
  setFields(form, {
    ...context.lookups,
    ...donor,
    ...consistencyFixes(values, context.agency),
  });
  const page = pageValues(w, form, job);
  // A instituição e o curso como foram enviados: vêm de cópias e trocas, e
  // um erro de chave no Lattes só se explica por eles.
  const sent: Record<string, string> = {};
  for (const name of ['f_cod_inst', 'f_cod_inst2', 'f_inst', 'f_cod_curso', 'f_cod_curso2']) {
    const el = form.elements.namedItem(name) as HTMLInputElement | null;
    if (el?.value) sent[`enviado:${name}`] = el.value;
  }
  return { ...values, ...page, ...sent };
}

/**
 * Sem item seu do mesmo formulário (a atuação nova), os campos de busca de
 * qualquer outro. Nunca os de lugar (f_seq_*, f_codinst): numa inclusão, eles
 * fariam a página alterar um item que já existe.
 */
function anyDonor(): Record<string, string> {
  const merged: Record<string, string> = {};
  for (const donor of Object.values(context.donors)) {
    for (const [name, value] of Object.entries(donor)) {
      if (/^f_(seq_|codinst$)/i.test(name) || name in merged) continue;
      merged[name] = value;
    }
  }
  return merged;
}

/** Os nomes dos campos de um formulário: o mesmo passo de novo tem os mesmos. */
const signature = (form: HTMLFormElement) =>
  [...new Set([...form.elements].map((el) => (el as HTMLInputElement).name).filter(Boolean))]
    .sort()
    .join(',');

/** O "Salvar" da página, como a pessoa clicaria. */
function saveButton(doc: Document): HTMLElement | undefined {
  return [...doc.querySelectorAll<HTMLElement>('input[type=button], button, a')].find((b) =>
    /^\s*salvar\s*$/i.test((b as HTMLInputElement).value || b.textContent || ''),
  );
}

async function createOne(job: TestJob, code: string): Promise<TestResult> {
  const base = {
    id: job.id,
    msgs: [] as string[],
    ok: false,
    tag: job.tag,
    values: {},
    variant: job.variant,
  };
  let frame: HTMLIFrameElement | undefined;
  try {
    frame = await openFrame(placed(job), code);
    const w = frame.contentWindow as FrameWindow;
    const form = w.document.forms.namedItem(job.form);
    if (!form) return { ...base, msgs: [`A página não tem o formulário ${job.form}`] };
    addOwner(w);
    let values = fill(w, form, job);
    const seen = new Set([signature(form)]);
    // Alguns formulários têm um segundo passo (a formação complementar pede os
    // anos depois): a página nova, sem sucesso nem erro, é preenchida e salva.
    for (let step = 0; step < 3; step++) {
      const msgs = await submit(frame, (sw) => {
        // O botão da própria página: em alguns formulários (formação) o check()
        // só valida, e é o clique que chama o envio.
        const save = saveButton(sw.document);
        if (save) save.click();
        else sw.check?.();
      });
      const fw = frame.contentWindow as FrameWindow;
      if (msgs.length > 0 || step === 2) {
        const ok = msgs.some((m) => /sucesso/i.test(m));
        return {
          ...base,
          msgs: msgs.filter((m) => !/sucesso/i.test(m)),
          ok,
          uncertain: !ok && frameState(frame).submitted,
          values,
        };
      }
      // Só um formulário com outros campos segue (a formação complementar
      // posta os dois passos na mesma ação): o mesmo de novo seria a página
      // recarregada, e salvar de novo duplicaria o item.
      const next = [...fw.document.forms].find(
        (f) => !seen.has(signature(f)) && saveButton(f.ownerDocument),
      );
      if (!next) {
        // O texto da página que voltou: um erro do servidor aparece só ali.
        const text = (fw.document.body?.innerText ?? '').replace(/\s+/g, ' ').trim();
        const ctr = (fw.document.forms[0]?.elements.namedItem('f_ctr') as HTMLInputElement | null)
          ?.value;
        const msg = `A página voltou sem mensagem e sem outro passo (f_ctr ${ctr ?? '-'}): ${text.slice(0, 300)}`;
        return { ...base, msgs: [msg], uncertain: true, values };
      }
      seen.add(signature(next));
      values = { ...values, ...fill(fw, next, job) };
    }
    return { ...base, msgs: ['Passos demais'], uncertain: true, values };
  } catch (err) {
    return {
      ...base,
      msgs: [err instanceof Error ? err.message : String(err)],
      uncertain: frame ? frameState(frame).submitted : false,
    };
  } finally {
    frame?.remove();
  }
}

/** O próximo lote de itens de teste: cria, guarda o andamento e devolve o resumo. */
export async function createTestItems(
  jobs: TestJob[],
  code: string,
  get: (path: string) => Promise<{ html: string }>,
  {
    batch = TEST_BATCH_LIMIT,
    confirmedAbsent = [],
    confirmedPresent = [],
    delayMs = [3000, 6000],
    only,
    project,
    receiver,
    retryFailed = false,
  }: BatchOptions = {},
) {
  testBatchSize(batch);
  if (receiver && !/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//.test(receiver))
    throw new Error('O receptor de resultados precisa ser local');
  if (!loadBase()) throw new Error('Sem a base das listas: rode "Ler formulários" antes de criar.');
  await ensureContext(code, get);
  context.project = project
    ? await projectFields(code, get, project.institution, project.organ ?? false)
    : undefined;
  const progress = load();
  const tried = new Map(progress.results.map((r) => [r.tag, r]));
  if (retryFailed && progress.results.some((r) => r.uncertain)) {
    const mirror = await get(`pkg_publicar.cv_espelho?f_cod=${code}&f_idioma=1`);
    if (!isEspelhoPage(mirror.html))
      throw new Error('Não foi possível conferir os envios incertos no Lattes');
    for (const r of progress.results) {
      if (!r.uncertain) continue;
      if (confirmedPresent.includes(r.tag) && mirror.html.includes(r.tag)) {
        r.uncertain = false;
        r.ok = true;
        continue;
      }
      if (!confirmedAbsent.includes(r.tag)) continue;
      if (mirror.html.includes(r.tag))
        throw new Error(`O item ${r.tag} já aparece no Lattes; não será repetido`);
      r.uncertain = false;
    }
    save(progress);
  }
  if (progress.results.some((r) => r.uncertain) || progress.pendingRemovals?.length)
    throw new Error(
      'Há envios ou exclusões incertos; confira e reconcilie o registro antes de continuar',
    );
  const next = jobs
    .filter((j) => !only || only.includes(j.id))
    .filter((j) => {
      const r = tried.get(j.tag);
      return !r || (!r.ok && !r.uncertain && retryFailed);
    })
    .slice(0, batch);
  setLive({ done: 0, last: undefined, phase: 'criando', total: next.length });
  for (const job of next) {
    censusTraffic.signal.throwIfAborted();
    // Grava antes do envio: fechar a aba ou reiniciar o worker não libera repetição.
    const marker: TestResult = {
      id: job.id,
      msgs: ['Envio iniciado; confira no Lattes antes de repetir'],
      ok: false,
      tag: job.tag,
      uncertain: true,
      values: {},
      variant: job.variant,
    };
    progress.results = [...progress.results.filter((r) => r.tag !== job.tag), marker];
    save(progress);
    const result = await createOne(job, code);
    if (result.ok) {
      const mirror = await get(`pkg_publicar.cv_espelho?f_cod=${code}&f_idioma=1`);
      if (!isEspelhoPage(mirror.html) || !mirror.html.includes(job.tag)) {
        result.ok = false;
        result.uncertain = true;
        result.msgs.push('O item não foi confirmado na leitura depois do envio');
      }
    }
    setLive({ done: (live()?.done ?? 0) + 1, last: `${job.tag} ${result.ok ? 'ok' : 'falhou'}` });
    progress.results = [...progress.results.filter((r) => r.tag !== job.tag), result];
    save(progress);
    if (result.uncertain)
      throw new Error(`O envio de ${job.tag} ficou incerto; confira no Lattes antes de continuar`);
    censusTraffic.signal.throwIfAborted();
    await pause(delayMs);
  }
  // O registro: o que as listas têm agora a mais que a base.
  setLive({ phase: 'lendo' });
  const ledger = await ledgerNow(document.documentElement.outerHTML, code, get);
  progress.added = ledger.added;
  progress.missing = ledger.missing;
  save(progress);
  setLive({ phase: 'parado' });
  let receiverError: string | undefined;
  if (receiver) {
    try {
      await censusTraffic.sendResults(receiver, JSON.stringify(progress.results));
    } catch {
      receiverError = 'Os itens foram conferidos, mas o receptor local não recebeu o resultado';
    }
  }
  return { ...testProgress(jobs), lote: next.map((j) => j.tag), receptorError: receiverError };
}

/** Quantos foram criados, quais falharam (com a mensagem do Lattes) e quantos faltam. */
export function testProgress(jobs?: TestJob[]) {
  const progress = load();
  const failed = progress.results.filter((r) => !r.ok);
  return {
    agora: live(),
    base: loadBase()?.at ?? null,
    criados: progress.results.filter((r) => r.ok).length,
    exclusoesIncertas: progress.pendingRemovals ?? [],
    falharam: failed.map((r) => ({ msgs: r.msgs, tag: r.tag })),
    faltam: jobs ? jobs.filter((j) => !progress.results.some((r) => r.tag === j.tag)).length : null,
    faltandoDaBase: (progress.missing ?? []).map((r) => `${r.list} :: ${r.text}`),
    incertos: failed.filter((r) => r.uncertain).map((r) => r.tag),
    registrados: progress.added?.length ?? 0,
    removidos: progress.removed.length,
    total: jobs?.length ?? null,
  };
}

/** Esquece o andamento guardado (depois de remover tudo). */
export function resetTestItems(options: { force?: boolean } = {}): void {
  if (censusTraffic.running) throw new Error('Espere a tarefa terminar antes de apagar o registro');
  let progress: Progress | undefined;
  try {
    progress = load();
  } catch {
    if (!options.force)
      throw new Error(
        'Registro ilegível: confira os itens no Lattes e use resetTestItems({force: true}) para apagar',
      );
  }
  if (progress && (progress.results.some((r) => r.uncertain) || progress.pendingRemovals?.length))
    throw new Error('Confira e reconcilie os envios incertos antes de apagar o registro');
  clearBase();
  localStorage.removeItem(STORE);
}
