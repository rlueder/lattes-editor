// Os itens de teste da passada completa, rodados pela pessoa na aba do menu
// do Lattes (docs/lattes-formularios/itens-de-teste.md). Cada chamada cria
// ou remove um lote pequeno, com pausa entre um envio e outro, e guarda o
// andamento neste navegador para a chamada seguinte continuar dali.
//
// O formulário de cada item abre num quadro dentro da própria página, e é a
// página que valida e envia (check() e enviar()), como quando a pessoa clica
// em "Salvar". As mensagens que ela mostraria na caixa do Lattes voltam no
// resultado em vez de aparecer na tela.

import {
  consistencyFixes,
  matchesCreated,
  pickOption,
  TEST_MARK,
  type TestJob,
  textValue,
} from '../../src/census/test-plan.ts';
import {
  context,
  editLinks,
  ensureContext,
  placed,
  PLACELESS,
  setFields,
} from './censo-test-donors.ts';
import { pageValues, silenceDialogs } from './censo-test-pages.ts';

export interface TestResult {
  id: string;
  msgs: string[];
  ok: boolean;
  tag: string;
  values: Record<string, string>;
  variant: number;
}

export interface BatchOptions {
  /** Itens por chamada (padrão 10). */
  batch?: number;
  /** Pausa entre um envio e outro, sorteada entre os dois (padrão 3 a 6 s). */
  delayMs?: [number, number];
  /** Endereço que recebe os resultados por POST, além do armazenamento local. */
  receiver?: string;
  /** Tenta de novo os que falharam (depois de ajustar o que faltava). */
  retryFailed?: boolean;
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
  removed: string[];
  results: TestResult[];
}

function load(): Progress {
  try {
    const raw = localStorage.getItem(STORE);
    if (raw) return JSON.parse(raw) as Progress;
  } catch {
    // Armazenamento bloqueado ou estragado: começa do zero.
  }
  return { removed: [], results: [] };
}

function save(p: Progress): void {
  try {
    localStorage.setItem(STORE, JSON.stringify(p));
  } catch {
    // Sem armazenamento, o resultado ainda volta da chamada e vai ao receptor.
  }
}

const pause = ([min, max]: [number, number]) =>
  new Promise((r) => setTimeout(r, min + Math.random() * (max - min)));

interface MsgBox {
  exibir: (p: { conteudo?: string; fnConfirmar?: string; tipo?: string }) => unknown;
}

/** O formulário num quadro da página, já carregado. */
function openFrame(path: string, code: string): Promise<HTMLIFrameElement> {
  return new Promise((resolve, reject) => {
    const frame = document.createElement('iframe');
    frame.style.cssText = 'position:fixed;right:0;bottom:0;width:900px;height:600px;z-index:99999';
    const url = new URL(`/cvlattesweb/${path}`, location.origin);
    url.searchParams.set('f_cod', code);
    frame.src = url.href;
    const timer = setTimeout(() => reject(new Error('O formulário não abriu')), 30_000);
    frame.onload = () => {
      clearTimeout(timer);
      silenceDialogs(frame.contentWindow!);
      resolve(frame);
    };
    document.body.append(frame);
  });
}

type FrameWindow = Window & {
  autorGrid?: { getProvider: () => Record<string, unknown>[] };
  check?: () => void;
  del?: () => void;
  enviar?: () => void;
};

/**
 * Envia pelo caminho da página e espera a resposta: a mensagem de sucesso, a
 * lista de problemas do check() ou a página nova no quadro.
 */
function submit(frame: HTMLIFrameElement, start: (w: FrameWindow) => void): Promise<string[]> {
  return new Promise((resolve) => {
    const w = frame.contentWindow as FrameWindow;
    const box = (window as unknown as { caixaMsg?: MsgBox }).caixaMsg;
    const original = box?.exibir;
    const msgs: string[] = [];
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      if (box && original) box.exibir = original;
      resolve(msgs);
    };
    if (box) {
      box.exibir = (p) => {
        // A pergunta da privacidade, ou outra confirmação: confirma.
        if (p.tipo === 'confirm') {
          w.enviar?.();
          return;
        }
        msgs.push(
          String(p.conteudo ?? '')
            .replace(/<br\s*\/?>/gi, ' ')
            .trim(),
        );
        finish();
      };
    }
    w.confirm = () => true;
    silenceDialogs(w);
    frame.onload = () => setTimeout(finish, 1500);
    try {
      start(w);
    } catch (err) {
      msgs.push(`exceção: ${String(err)}`);
      finish();
    }
    setTimeout(() => {
      msgs.push('sem resposta em 30 s');
      finish();
    }, 30_000);
  });
}

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
  return { ...values, ...pageValues(w, form, job) };
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
        return { ...base, msgs: msgs.filter((m) => !/sucesso/i.test(m)), ok, values };
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
        return { ...base, msgs: [msg], values };
      }
      seen.add(signature(next));
      values = { ...values, ...fill(fw, next, job) };
    }
    return { ...base, msgs: ['Passos demais'], values };
  } catch (err) {
    return { ...base, msgs: [err instanceof Error ? err.message : String(err)] };
  } finally {
    frame?.remove();
  }
}

/** O próximo lote de itens de teste: cria, guarda o andamento e devolve o resumo. */
export async function createTestItems(
  jobs: TestJob[],
  code: string,
  get: (path: string) => Promise<{ html: string }>,
  { batch = 10, delayMs = [3000, 6000], receiver, retryFailed = false }: BatchOptions = {},
) {
  await ensureContext(code, get);
  const progress = load();
  const tried = new Map(progress.results.map((r) => [r.tag, r]));
  const next = jobs
    .filter((j) => {
      const r = tried.get(j.tag);
      return !r || (!r.ok && retryFailed);
    })
    .slice(0, batch);
  setLive({ done: 0, last: undefined, phase: 'criando', total: next.length });
  for (const job of next) {
    const result = await createOne(job, code);
    setLive({ done: (live()?.done ?? 0) + 1, last: `${job.tag} ${result.ok ? 'ok' : 'falhou'}` });
    progress.results = [...progress.results.filter((r) => r.tag !== job.tag), result];
    save(progress);
    await pause(delayMs);
  }
  if (receiver) {
    await fetch(receiver, { body: JSON.stringify(progress.results), method: 'POST' }).catch(
      () => undefined,
    );
  }
  setLive({ phase: 'parado' });
  return { ...testProgress(jobs), lote: next.map((j) => j.tag) };
}

/** Quantos foram criados, quais falharam (com a mensagem do Lattes) e quantos faltam. */
export function testProgress(jobs?: TestJob[]) {
  const progress = load();
  const failed = progress.results.filter((r) => !r.ok);
  return {
    agora: live(),
    criados: progress.results.filter((r) => r.ok).length,
    falharam: failed.map((r) => ({ msgs: r.msgs, tag: r.tag })),
    faltam: jobs ? jobs.filter((j) => !progress.results.some((r) => r.tag === j.tag)).length : null,
    removidos: progress.removed.length,
    total: jobs?.length ?? null,
  };
}

const withoutCode = (p: string) => p.replace(/([?&])f_cod=[A-Z0-9]+&?/, '$1').replace(/[?&]$/, '');

/**
 * Remove um lote dos itens de teste: percorre as listas do menu, abre cada
 * item cujo formulário tem o marcador e o exclui pelo próprio botão da página.
 */
export async function removeTestItems(
  code: string,
  get: (path: string) => Promise<{ html: string }>,
  { batch = 10, delayMs = [3000, 6000] }: BatchOptions = {},
) {
  const menu = document.documentElement.outerHTML;
  const lists = [
    ...new Set(
      [...menu.matchAll(/setarUrl\('([^']+)'/g)]
        .map((m) => withoutCode(m[1]!.replace(/&amp;/g, '&')))
        .filter((p) => /lista/i.test(p)),
    ),
  ];
  const progress = load();
  const removed: string[] = [];
  setLive({ done: 0, last: undefined, phase: 'removendo', total: batch });
  for (const list of lists) {
    if (removed.length >= batch) break;
    const items = editLinks((await get(list)).html).map(withoutCode);
    for (const path of items) {
      if (removed.length >= batch) break;
      const html = (await get(path)).html;
      const created = progress.results.filter((r) => r.ok && r.id !== 'idioma');
      if (!html.includes(TEST_MARK) && !created.some((r) => matchesCreated(html, r.values)))
        continue;
      const frame = await openFrame(path, code);
      try {
        const w = frame.contentWindow as FrameWindow;
        await submit(frame, (fw) => {
          if (fw.del) fw.del();
          else {
            const form = fw.document.forms[0];
            const ctr = form?.elements.namedItem('f_ctr') as HTMLInputElement | null;
            if (!form || !ctr) throw new Error('Sem como excluir nesta página');
            ctr.value = 'E';
            form.submit();
          }
        });
        if (!w.document) continue;
        removed.push(path);
        progress.removed = [...progress.removed, path];
        save(progress);
        setLive({ done: removed.length, last: path.split('?')[0] });
      } finally {
        frame.remove();
      }
      await pause(delayMs);
    }
  }
  setLive({ phase: 'parado' });
  return { removidos: removed.length, total: progress.removed.length };
}

/** Esquece o andamento guardado (depois de remover tudo). */
export function resetTestItems(): void {
  try {
    localStorage.removeItem(STORE);
  } catch {
    // Nada guardado.
  }
}
