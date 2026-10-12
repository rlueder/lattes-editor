// Painel da ponte: a fila que o editor mandou, um botão por alteração e um
// para todas, o resultado de cada uma e o botão de parar.

import type { OpResult } from '../../src/bridge/apply.ts';
import {
  type ContractReport,
  driftText,
  isBreaking,
  issueUrl,
  reportText,
} from '../../src/bridge/contract.ts';
import { opRows } from '../../src/bridge/field-labels.ts';
import { giveConsent, hasConsent, PRIVACY_URL } from './consent.ts';
import type { PanelCommand, QueueState } from './state.ts';
import { readState } from './state.ts';
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
        'As alterações chegam aqui pelo editor. Abra "Levar ao Lattes" e use "Enviar pela extensão".',
    }),
    el('p', {
      className: 'vazio-texto',
      textContent: 'Cada uma é gravada no Lattes, lida de volta e conferida antes da próxima.',
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
  verify.textContent = state.verificando ? 'Verificando…' : 'Verificar o Lattes';
  renderReport(state.verificacao);
  // Sem fila, sem botões: o estado vazio fala sozinho.
  document.querySelector<HTMLElement>('.acoes')!.hidden = state.ops.length === 0;
  document.querySelector<HTMLElement>('.ajuda')!.hidden = state.ops.length === 0;
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

/** Aviso de uso no lugar da ponte até o "ok" (ver consent.ts). */
async function showConsentOrBridge(): Promise<void> {
  const ok = await hasConsent();
  document.getElementById('aviso')!.hidden = ok;
  document.getElementById('ponte')!.hidden = !ok;
}
(document.getElementById('aviso-politica') as HTMLAnchorElement).href = PRIVACY_URL;
document.getElementById('aceitar')!.addEventListener('click', () => void giveConsent());
chrome.storage.onChanged.addListener((_changes, area) => {
  if (area === 'local') void showConsentOrBridge();
  else void readState().then(render);
});
void showConsentOrBridge();
void readState().then(render);

// Avisa o service worker do tema da barra (ver toolbar-icon.ts), agora e a cada troca.
const darkScheme = matchMedia('(prefers-color-scheme: dark)');
const reportToolbarTheme = () =>
  void chrome.runtime.sendMessage({ toolbar: toolbarTheme(darkScheme.matches) });
reportToolbarTheme();
darkScheme.addEventListener('change', reportToolbarTheme);
