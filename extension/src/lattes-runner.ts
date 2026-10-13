// Injetado na aba do menu do Lattes. Roda o núcleo da ponte com a sessão do
// próprio usuário: fetch na mesma origem (cookies dele), DOMParser para ler
// os formulários. Nada de senha passa por aqui.

import { applyOp, type LattesPort } from '../../src/bridge/apply.ts';
import { checkContract } from '../../src/bridge/contract.ts';
import { type EspelhoItem, isEspelhoPage, parseEspelho } from '../../src/bridge/espelho.ts';
import { exportCv, type ExportPort, toBase64 } from '../../src/bridge/export.ts';
import type { FormControl } from '../../src/bridge/form.ts';
import { cvCodeFrom, isLogonPage, lattesIdFrom } from '../../src/bridge/lattes-html.ts';
import { lattesStatusFrom } from '../../src/bridge/lattes-status.ts';
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

const exportPort: ExportPort = {
  async get(path) {
    const res = await fetch(new URL(path, location.href), { credentials: 'include' });
    return { html: await text(res), url: res.url };
  },
  async postForBytes(path, body) {
    const res = await fetch(new URL(path, location.href), {
      body,
      credentials: 'include',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      method: 'POST',
    });
    return {
      bytes: new Uint8Array(await res.arrayBuffer()),
      contentType: res.headers.get('content-type') ?? '',
      disposition: res.headers.get('content-disposition') ?? '',
      url: res.url,
    };
  },
};

/** O que volta ao service worker: o ZIP em base64 (a mensagem é JSON), ou o motivo. */
interface ExportReply {
  detail?: string;
  fileName?: string;
  lattesId?: string;
  reason?: 'erro' | 'pendente' | 'sessao';
  zip?: string;
}

(globalThis as unknown as { __ponte: unknown }).__ponte = {
  apply: (op: BridgeOp) => applyOp(op, port),
  // Só leitura: a página de conferência, com o que ainda não foi enviado ao
  // CNPq (docs/lattes_internals.md, seção 10). O código do currículo vem do
  // menu da aba.
  espelho: async (): Promise<{ error?: string; items?: EspelhoItem[]; lattesId?: string }> => {
    const menu = document.documentElement.outerHTML;
    const code = cvCodeFrom(menu);
    const lattesId = lattesIdFrom(menu);
    if (!code) return { error: 'Não achei o código do currículo no menu do Lattes.', lattesId };
    try {
      const res = await fetch(`pkg_publicar.cv_espelho?f_cod=${code}&f_idioma=1`, {
        credentials: 'include',
      });
      const html = await text(res);
      if (isLogonPage(html, res.url)) return { error: 'A sessão do Lattes caiu.', lattesId };
      if (!res.ok || !isEspelhoPage(html)) {
        return { error: 'O Lattes não devolveu a página de conferência.', lattesId };
      }
      return { items: parseEspelho(html), lattesId };
    } catch {
      return { error: 'A aba do Lattes não respondeu.', lattesId };
    }
  },
  // Abrir do Lattes: o mesmo ZIP do "Exportar" (src/bridge/export.ts), do
  // currículo da sessão aberta nesta aba.
  exportar: async (): Promise<ExportReply> => {
    const menu = document.documentElement.outerHTML;
    const lattesId = lattesIdFrom(menu);
    try {
      const r = await exportCv(exportPort, cvCodeFrom(menu), lattesId);
      if (r.ok) return { fileName: r.fileName, lattesId, zip: toBase64(r.bytes) };
      return { detail: r.detail, lattesId, reason: r.reason as ExportReply['reason'] };
    } catch {
      return { detail: 'A aba do Lattes não respondeu.', lattesId, reason: 'erro' };
    }
  },
  // Ao conectar, o menu que já está na aba. Depois de uma fila, um GET novo do
  // menu (só o cookie basta, ver docs/lattes_internals.md, seção 10), porque
  // a página aberta não sabe das gravações; se a sessão caiu, fica a da aba.
  identity: async (fresh = false) => {
    let html = document.documentElement.outerHTML;
    if (fresh) {
      try {
        const res = await fetch('PKG_MENU.menu', { credentials: 'include' });
        const menu = await text(res);
        if (res.ok && !isLogonPage(menu, res.url)) html = menu;
      } catch {
        // Rede ou aba navegando: fica o menu da aba, como quando a sessão cai.
      }
    }
    return { code: cvCodeFrom(html), lattesId: lattesIdFrom(html), status: lattesStatusFrom(html) };
  },
  // Só leituras: o menu e um exemplar de cada formulário, comparados ao contrato.
  verificar: () => checkContract(port),
};
