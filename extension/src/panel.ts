// Painel do conector: a fila que o editor mandou, um botão por alteração e um
// para todas, o resultado de cada uma e o botão de parar.

import type { OpResult } from '../../src/bridge/apply.ts';
import { versionNotice } from '../../src/bridge/compat.ts';
import {
  type ContractReport,
  driftText,
  isBreaking,
  issueUrl,
  reportText,
} from '../../src/bridge/contract.ts';
import { opRows } from '../../src/bridge/field-labels.ts';
import { PUBLISH_REMINDER } from '../../src/bridge/lattes-status.ts';
import { listText } from '../../src/bridge/list-watch.ts';
import { giveConsent, hasConsent, PRIVACY_URL } from './consent.ts';
import type { AppHello, PanelCommand, QueueState } from './state.ts';
import { APP_KEY, readState } from './state.ts';
import { toolbarTheme } from './toolbar-icon.ts';

const STATUS: Record<OpResult['status'], string> = {
  conferido: 'Conferido',
  divergente: 'Diferente no Lattes',
  erro: 'Erro',
  sessao: 'Sessão caiu',
};

const send = (cmd: PanelCommand) => void chrome.runtime.sendMessage(cmd);

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<HTMLElementTagNameMap[K]> = {},
  children: (Node | string)[] = [],
): HTMLElementTagNameMap[K] {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
}

/** Folhas empilhadas em traço, o mesmo desenho dos estados vazios do editor. */
const SHEETS = `<svg aria-hidden="true" class="vazio-arte" fill="none" height="96" stroke="currentColor" stroke-linejoin="round" stroke-width="1.25" viewBox="0 0 96 96" width="96"><path d="M22 70 48 84l26-14"/><path d="M22 64 48 78l26-14"/><path d="M22 58 48 72l26-14L48 44 22 58Z"/><path d="M33 22h30l7 7v27H33V22Z" transform="rotate(-8 51 39)"/><path d="M40 32h16M40 38h22M40 44h18" transform="rotate(-8 51 39)"/></svg>`;

function emptyState(): HTMLElement {
  const art = el('div');
  art.innerHTML = SHEETS;
  return el('li', { className: 'vazio' }, [
    art.firstElementChild!,
    el('h2', { className: 'vazio-titulo', textContent: 'Nada na fila' }),
    el('p', {
      className: 'vazio-texto',
      textContent:
        'As alterações chegam aqui pelo editor. Abra "Enviar ao Lattes" e use "Enviar pela extensão".',
    }),
  ]);
}

const VERSION = chrome.runtime.getManifest().version;

const REPORT_TITLE: Record<ContractReport['status'], string> = {
  erro: 'Não deu para verificar',
  mudou: 'O Lattes mudou',
  ok: 'Lattes como o esperado',
  sessao: 'Sessão caiu',
};

/** Título da seção da verificação, que só aparece quando algo não está ok. */
const VIGIA_HEADING: Record<ContractReport['status'], string> = {
  erro: 'Não deu para verificar o Lattes',
  mudou: 'O Lattes mudou desde a última versão do conector',
  ok: '',
  sessao: 'A sessão do Lattes caiu; entre de novo para enviar',
};

const FORM_TITLE: Record<string, string> = {
  GN_ATIV_VINC: 'Vínculo',
  GN_IDIOMA: 'Idioma',
  RES: 'Resumo',
};

function renderReport(report: ContractReport | undefined): void {
  const root = document.getElementById('vigia-resultado')!;
  root.replaceChildren();
  if (!report) return;
  const when = new Date(report.checkedAt).toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
  root.append(
    el('p', {}, [
      el('span', {
        className: `vigia-resumo ${report.status}`,
        textContent: REPORT_TITLE[report.status],
      }),
      ' ',
      el('span', { className: 'detalhe', textContent: `em ${when}` }),
    ]),
  );
  if (report.detail) root.append(el('p', { className: 'detalhe', textContent: report.detail }));
  const lines = [
    ...report.menu.filter((m) => !m.found).map((m) => `Menu: link ${m.proc} sumiu`),
    ...report.forms.flatMap((f) =>
      f.status === 'sem-amostra'
        ? [`${FORM_TITLE[f.form] ?? f.form}: sem amostra (${f.detail ?? ''})`]
        : f.drifts.map((d) => `${driftText(d)}${isBreaking(d) ? '' : ' (não impede o envio)'}`),
    ),
    // Lista do Lattes diferente da do editor: os campos tipados precisam de
    // atualização, mas o envio segue.
    ...(report.lists ?? [])
      .filter((l) => l.status !== 'ok')
      .map((l) => `${listText(l)} (não impede o envio)`),
  ];
  if (lines.length) {
    root.append(
      el(
        'ul',
        { className: 'vigia-lista' },
        lines.map((t) => el('li', { textContent: t })),
      ),
    );
  }
  if (report.status === 'ok') return;
  // O relatório só tem nomes de campos e procedimentos; pode ir para uma issue pública.
  const copy = el('button', {
    className: 'fantasma',
    textContent: 'Copiar relatório',
    type: 'button',
  });
  copy.addEventListener('click', () => {
    navigator.clipboard.writeText(reportText(report, VERSION)).then(
      () => {
        copy.textContent = 'Copiado';
      },
      () => {
        // Sem permissão ou sem foco: o botão avisa, e o texto segue no painel.
        copy.textContent = 'Não deu para copiar';
      },
    );
  });
  const issue = el('a', {
    href: issueUrl(report, VERSION),
    rel: 'noreferrer',
    target: '_blank',
    textContent: 'Abrir issue no GitHub',
  });
  root.append(el('div', { className: 'vigia-acoes' }, [copy, issue]));
}

function render(state: QueueState): void {
  const root = document.getElementById('fila')!;
  const action = document.getElementById('acao') as HTMLButtonElement;
  const pending = state.ops.filter((op) => state.results[op.key]?.status !== 'conferido');
  // Um botão, três estados: aplicar, parar enquanto corre, tudo conferido.
  const mode = state.running
    ? 'parar'
    : pending.length === 0 && state.ops.length > 0
      ? 'ok'
      : 'aplicar';
  action.dataset.modo = mode;
  action.className = mode === 'parar' ? 'parar' : mode === 'ok' ? 'conferido' : 'principal';
  action.disabled = mode === 'ok' || state.ops.length === 0;
  action.textContent =
    mode === 'parar' ? 'Parar' : mode === 'ok' ? '✓ Tudo conferido' : 'Aplicar todas';
  root.replaceChildren();
  const verify = document.getElementById('verificar') as HTMLButtonElement;
  verify.disabled = Boolean(state.running || state.verificando);
  verify.textContent = state.verificando ? 'Verificando…' : 'Verificar de novo';
  // O título diz o que houve: mudança no Lattes, sessão caída ou leitura que falhou.
  document.getElementById('vigia-titulo')!.textContent = state.verificacao
    ? VIGIA_HEADING[state.verificacao.status]
    : '';
  // A verificação roda sozinha; com o Lattes como o esperado, nada aparece.
  document.querySelector<HTMLElement>('.vigia')!.hidden =
    !state.verificacao || state.verificacao.status === 'ok';
  renderReport(state.verificacao);
  // Sem fila, sem botões: o estado vazio fala sozinho.
  document.querySelector<HTMLElement>('.acoes')!.hidden = state.ops.length === 0;
  document.querySelector<HTMLElement>('.ajuda')!.hidden = state.ops.length === 0;
  // Fila parada com algo conferido: lembra que nada está público ainda.
  const reminder = document.querySelector<HTMLElement>('.lembrete')!;
  reminder.textContent = PUBLISH_REMINDER;
  reminder.hidden =
    state.running || !Object.values(state.results).some((r) => r.status === 'conferido');
  if (state.ops.length === 0) {
    root.append(emptyState());
    return;
  }
  for (const op of state.ops) {
    const r = state.results[op.key];
    const button = el('button', {
      disabled: state.running || r?.status === 'conferido',
      textContent: 'Aplicar',
      type: 'button',
    });
    button.addEventListener('click', () => send({ cmd: 'aplicar', keys: [op.key] }));
    const status = r?.status;
    const fields = el(
      'dl',
      { className: 'campos' },
      opRows(op).flatMap((row) => [
        el('dt', { textContent: row.label }),
        el('dd', {}, [
          el('span', { className: 'antes', textContent: row.before }),
          ' → ',
          el('span', { textContent: row.after }),
        ]),
      ]),
    );
    const detail =
      r && r.status !== 'conferido' ? el('p', { className: 'detalhe', textContent: r.detail }) : '';
    root.append(
      el('li', { className: status ? `item ${status}` : 'item' }, [
        el('div', { className: 'item-topo' }, [
          el('div', { className: 'titulo', textContent: op.label }),
          el('span', { className: 'selo', textContent: status ? STATUS[status] : 'Na fila' }),
        ]),
        fields,
        detail,
        status === 'conferido' ? '' : el('div', { className: 'item-acoes' }, [button]),
      ]),
    );
  }
}

document.getElementById('acao')!.addEventListener('click', (e) => {
  const mode = (e.currentTarget as HTMLButtonElement).dataset.modo;
  send(mode === 'parar' ? { cmd: 'parar' } : { cmd: 'aplicar' });
});
document.getElementById('limpar')!.addEventListener('click', () => send({ cmd: 'limpar' }));
document.getElementById('verificar')!.addEventListener('click', () => send({ cmd: 'verificar' }));

/** Aviso de uso no lugar do conector até o "ok" (ver consent.ts). */
async function showConsentOrBridge(): Promise<void> {
  const ok = await hasConsent();
  document.getElementById('aviso')!.hidden = ok;
  document.getElementById('conector')!.hidden = !ok;
}
(document.getElementById('aviso-politica') as HTMLAnchorElement).href = PRIVACY_URL;
document.getElementById('aceitar')!.addEventListener('click', () => {
  giveConsent().catch(() => {
    document.querySelector('.aviso-nota')!.textContent =
      'Não deu para guardar o "ok". Feche e abra o painel e tente de novo.';
  });
});
/** App e extensão de versões que não combinam: diz qual dos dois atualizar. */
async function renderVersions(): Promise<void> {
  const stored = await chrome.storage.session.get(APP_KEY);
  const notice = versionNotice(VERSION, stored[APP_KEY] as AppHello | undefined);
  const p = document.getElementById('versoes')!;
  p.textContent = notice ?? '';
  p.hidden = !notice;
}

chrome.storage.onChanged.addListener((_changes, area) => {
  if (area === 'local') void showConsentOrBridge();
  else {
    void readState().then(render);
    void renderVersions();
  }
});
void showConsentOrBridge();
void readState().then(render);
// Painel aberto: confere o Lattes em segundo plano, se estiver aberto e se já
// passou o intervalo (background.ts, verify).
send({ auto: true, cmd: 'verificar' });
void renderVersions();

// Avisa o service worker do tema da barra (ver toolbar-icon.ts), agora e a cada troca.
const darkScheme = matchMedia('(prefers-color-scheme: dark)');
const reportToolbarTheme = () =>
  void chrome.runtime.sendMessage({ toolbar: toolbarTheme(darkScheme.matches) });
reportToolbarTheme();
darkScheme.addEventListener('change', reportToolbarTheme);
