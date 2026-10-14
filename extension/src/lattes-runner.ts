// Injetado na aba do menu do Lattes. Roda o núcleo do conector com a sessão do
// próprio usuário: fetch na mesma origem (cookies dele), DOMParser para ler
// os formulários. Nada de senha passa por aqui.

import { applyOp, type LattesPort } from '../../src/bridge/apply.ts';
import { checkContract } from '../../src/bridge/contract.ts';
import { type EspelhoItem, isEspelhoPage, parseEspelho } from '../../src/bridge/espelho.ts';
import { exportCv, type ExportPort, fromBase64, toBase64 } from '../../src/bridge/export.ts';
import type { FormControl } from '../../src/bridge/form.ts';
import { importItems, type ImportPort, type ImportResult } from '../../src/bridge/importar.ts';
import { cvCodeFrom, isLogonPage, lattesIdFrom, sameCv } from '../../src/bridge/lattes-html.ts';
import {
  type ListsPort,
  readCourses,
  readLists,
  searchInstitutions,
} from '../../src/bridge/lattes-lists.ts';
import { lattesStatusFrom } from '../../src/bridge/lattes-status.ts';
import { type PhotoPort, type PhotoResult, uploadPhoto } from '../../src/bridge/photo.ts';
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

const photoPort: PhotoPort = {
  async get(path) {
    const res = await fetch(new URL(path, location.href), { credentials: 'include' });
    return { html: await text(res), url: res.url };
  },
  async getBytes(path) {
    const res = await fetch(new URL(path, location.href), {
      cache: 'no-store',
      credentials: 'include',
    });
    return {
      bytes: new Uint8Array(await res.arrayBuffer()),
      contentType: res.headers.get('content-type') ?? '',
      url: res.url,
    };
  },
  async postMultipart(path, fields, file) {
    // Como o formulário "fl": o arquivo primeiro, depois os campos escondidos.
    const body = new FormData();
    body.append(file.field, new Blob([file.bytes as BlobPart], { type: file.type }), file.name);
    for (const [name, value] of fields) body.append(name, value);
    const res = await fetch(new URL(path, location.href), {
      body,
      credentials: 'include',
      method: 'POST',
    });
    return { html: await text(res), url: res.url };
  },
};

const importPort: ImportPort = {
  get: (path) => photoPort.get(path),
  async post(path, body) {
    const res = await fetch(new URL(path, location.href), {
      body,
      credentials: 'include',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      method: 'POST',
    });
    return { html: await text(res), url: res.url };
  },
  // Como o formulário "fl" do passo 1: o arquivo, depois f_cod, f_ctr e f_ret.
  postMultipart: (path, fields, file) => photoPort.postMultipart(path, fields, file),
};

/** O pedido do Importar como chega do service worker (só texto passa pelo executeScript). */
interface ImportArgs {
  file: string;
  fileName: string;
  modules: number[];
  oldestYear?: number;
}

/** Só GET: as listas do Lattes (src/bridge/lattes-lists.ts) nunca gravam nada. */
const listsPort: ListsPort = {
  get: port.get,
  menuHtml: () => document.documentElement.outerHTML,
};

/** O que volta ao service worker: o ZIP em base64 (a mensagem é JSON), ou o motivo. */
interface ExportReply {
  detail?: string;
  fileName?: string;
  lattesId?: string;
  reason?: 'erro' | 'pendente' | 'sessao';
  zip?: string;
}

(globalThis as unknown as { __conector: unknown }).__conector = {
  apply: (op: BridgeOp) => applyOp(op, port),
  // Só leituras: os cursos de uma instituição num nível da formação.
  cursos: (institution: string, level: string) => readCourses(listsPort, institution, level),
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
  // Troca da foto (src/bridge/photo.ts), só se a sessão desta aba for do
  // currículo aberto no editor.
  foto: async (jpeg: string, expected?: string): Promise<PhotoResult> => {
    const menu = document.documentElement.outerHTML;
    const lattesId = lattesIdFrom(menu);
    if (!sameCv(expected, lattesId)) {
      return {
        detail: 'A sessão aberta no Lattes é de outro currículo.',
        ok: false,
        reason: 'outro-cv',
      };
    }
    try {
      return await uploadPhoto(photoPort, cvCodeFrom(menu), fromBase64(jpeg));
    } catch {
      return { detail: 'A aba do Lattes não respondeu.', ok: false, reason: 'erro' };
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
  // Importar dos itens novos (src/bridge/importar.ts): passos 1 e 2, e para
  // antes do passo 3. Só se a sessão desta aba for do currículo do editor.
  importar: async (args: string, expected?: string): Promise<ImportResult> => {
    const menu = document.documentElement.outerHTML;
    if (!sameCv(expected, lattesIdFrom(menu))) {
      return { detail: 'A sessão aberta no Lattes é de outro currículo.', reason: 'outro-cv' };
    }
    let req: ImportArgs;
    try {
      req = JSON.parse(args) as ImportArgs;
    } catch {
      return { detail: 'O pedido do Importar chegou ilegível à aba do Lattes.', reason: 'erro' };
    }
    try {
      return await importItems(importPort, cvCodeFrom(menu), {
        file: fromBase64(req.file),
        fileName: req.fileName,
        modules: req.modules,
        oldestYear: req.oldestYear,
      });
    } catch {
      // importItems trata sozinho as falhas depois do envio do arquivo (a
      // solicitação pendente); o que chega aqui é de antes dele.
      return { detail: 'A aba do Lattes não respondeu; nada foi enviado.', reason: 'erro' };
    }
  },
  // Só leituras: a busca de instituição, como a janela do próprio Lattes.
  instituicoes: (query: string, level: string) =>
    searchInstitutions(listsPort, query, level || undefined),
  // Só leituras: a tabela de áreas do menu e a lista de agências.
  listas: () => readLists(listsPort),
  // Só leituras: o menu e um exemplar de cada formulário, comparados ao contrato.
  verificar: () => checkContract(port),
};
