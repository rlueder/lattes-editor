// Injetado na aba do menu do Lattes. Roda o núcleo da ponte com a sessão do
// próprio usuário: fetch na mesma origem (cookies dele), DOMParser para ler
// os formulários. Nada de senha passa por aqui.

import { applyOp, type LattesPort } from '../../src/bridge/apply.ts';
import type { FormControl } from '../../src/bridge/form.ts';
import { cvCodeFrom } from '../../src/bridge/lattes-html.ts';
import type { BridgeOp } from '../../src/bridge/plan.ts';
import { decodeLatin1 } from '../../src/model/latin1.ts';

async function text(res: Response): Promise<string> {
  return decodeLatin1(new Uint8Array(await res.arrayBuffer()));
}

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

const port: LattesPort = {
  async get(path) {
    return text(await fetch(new URL(path, location.href), { credentials: 'include' }));
  },
  menuHtml: () => document.documentElement.outerHTML,
  async post(path, body) {
    const res = await fetch(new URL(path, location.href), {
      body,
      credentials: 'include',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      method: 'POST',
    });
    return text(res);
  },
  readForm(html, formName) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const form = doc.querySelector<HTMLFormElement>(`form[name="${formName}"]`);
    return form ? controlsOf(form) : undefined;
  },
};

(globalThis as unknown as { __ponte: unknown }).__ponte = {
  apply: (op: BridgeOp) => applyOp(op, port),
  cvCode: () => cvCodeFrom(document.documentElement.outerHTML),
};
