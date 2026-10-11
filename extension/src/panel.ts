// Painel da ponte: a fila que o editor mandou, um botão por alteração e um
// para todas, o resultado de cada uma e o botão de parar.

import type { OpResult } from '../../src/bridge/apply.ts';
import type { PanelCommand, QueueState } from './state.ts';
import { readState } from './state.ts';

const STATUS: Record<OpResult['status'], string> = {
  conferido: 'Conferido',
  divergente: 'Diferente no Lattes',
  erro: 'Erro',
  sessao: 'Sessão caiu',
};

/** Nomes dos campos dos formulários do Lattes, como a pessoa os conhece. */
const FIELD_LABELS: Record<string, string> = {
  f_ano_fim: 'Ano de fim',
  f_ano_ini: 'Ano de início',
  f_carga: 'Carga horária',
  f_enqua: 'Enquadramento',
  f_enqua_en: 'Enquadramento (inglês)',
  f_mes_fim: 'Mês de fim',
  f_mes_ini: 'Mês de início',
  f_outras_inf: 'Outras informações',
  f_outras_inf_en: 'Outras informações (inglês)',
  f_regime: 'Dedicação exclusiva',
  f_status: 'Situação',
  f_stavinc: 'Vínculo empregatício',
  F_TEXTO: 'Resumo',
  F_TEXTO_EN: 'Resumo (inglês)',
};

const shown = (v: string | null | undefined) => (v ? v : '(vazio)');

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
      Object.entries(op.set).flatMap(([name, value]) => [
        el('dt', { textContent: FIELD_LABELS[name] ?? name }),
        el('dd', {}, [
          el('span', { className: 'antes', textContent: shown(op.expect[name]) }),
          ' → ',
          el('span', { textContent: shown(value) }),
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
chrome.storage.onChanged.addListener(() => void readState().then(render));
void readState().then(render);
