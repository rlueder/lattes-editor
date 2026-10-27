// O núcleo do conector para rodar na aba do menu do Lattes pela ponte local
// (scripts/censo-ponte.ts), sem a extensão: o mesmo applyOp, a mesma leitura de
// formulários e o mesmo transporte, com os tetos de pedidos e o espaçamento.
// Só para testes acompanhados em desenvolvimento; não entra no app nem na
// extensão. Montado por scripts/build-conector-ponte.ts.

import { type ApplyGates, applyOp, BUILD_GATES, type LattesPort } from '../src/bridge/apply.ts';
import type { FormControl } from '../src/bridge/form.ts';
import type { BridgeOp } from '../src/bridge/plan.ts';
import { LattesTransport } from '../src/bridge/transport.ts';
import { decodeLatin1 } from '../src/model/latin1.ts';

function controlsOf(form: HTMLFormElement): FormControl[] {
  return [...form.elements].map((el) => {
    const c = el as HTMLInputElement & HTMLSelectElement & HTMLTextAreaElement;
    const isSelect = c.tagName === 'SELECT';
    return {
      checked: c.checked,
      disabled: c.disabled,
      maxLength: c.maxLength > 0 ? c.maxLength : undefined,
      name: c.name,
      selected: isSelect ? [...c.selectedOptions].map((o) => o.value) : undefined,
      type: isSelect ? c.type || 'select-one' : (c.type || c.tagName).toLowerCase(),
      value: c.value,
    };
  });
}

/** Uma tarefa por chamada: o teto de pedidos vale para cada operação. */
async function apply(op: BridgeOp, gates: Partial<ApplyGates> = {}) {
  const traffic = new LattesTransport();
  return traffic.run(() => {
    const request = (path: string, init?: RequestInit) =>
      traffic.request(new URL(path, location.href), { credentials: 'include', ...init });
    const text = async (res: Response) => decodeLatin1(await traffic.bytes(res));
    const port: LattesPort = {
      get: async (path) => text(await request(path)),
      menuHtml: () => document.documentElement.outerHTML,
      post: async (path, body) =>
        text(
          await request(path, {
            body,
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            method: 'POST',
          }),
        ),
      readForm(html, formName) {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const form = doc.querySelector<HTMLFormElement>(`form[name="${formName}"]`);
        return form ? controlsOf(form) : undefined;
      },
    };
    return applyOp(op, port, { ...BUILD_GATES, ...gates });
  });
}

(globalThis as unknown as { __conectorPonte: unknown }).__conectorPonte = { apply };
