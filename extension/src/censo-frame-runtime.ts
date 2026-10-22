// Este módulo executa apenas no quadro sandbox, cuja origem é opaca.
import { addOwner, fill, saveButton, signature } from './censo-frame-fill.ts';
import type { FrameCommand, FrameWindow } from './censo-frame-protocol.ts';
import { context } from './censo-test-donors.ts';

const page = window as FrameWindow;
const host = window.parent;
let port: MessagePort;
let active: { id: number; msgs: string[]; posted: boolean } | undefined;
let renderingResponse = false;
let owner: Record<string, string> | undefined;
let ownerAdded = false;
let confirmFor: number | undefined;
let confirmEvents = new EventTarget();
class FrameGuardError extends Error {
  override name = 'FrameGuardError';
}
const later = (work: () => void) => setTimeout(work, 0);
const reply = (id: number, value?: unknown, error?: string, fatal = false) =>
  port.postMessage({ error, fatal, id, value });
const fatalError = (error: unknown) =>
  error instanceof FrameGuardError || (error instanceof Error && error.name === 'SecurityError');
const fail = (error: unknown) => {
  const text =
    error instanceof Error && error.name === 'SecurityError'
      ? 'O formulário tentou acessar o menu fora da ponte do quadro isolado'
      : error instanceof Error
        ? error.message
        : String(error);
  if (active) {
    const id = active.id;
    active = undefined;
    confirmFor = undefined;
    reply(id, undefined, text, fatalError(error));
  } else port.postMessage({ error: text, type: 'error' });
};
const finish = () => {
  if (!active) return;
  const { id, msgs } = active;
  active = undefined;
  confirmFor = undefined;
  reply(id, msgs);
};
const confirmClick = () => {
  if (!active || confirmFor !== active.id) return;
  confirmFor = undefined;
  confirmEvents.dispatchEvent(new Event('click'));
};
const box = {
  btnConfirmar: {
    addEventListener: (...args: Parameters<EventTarget['addEventListener']>) =>
      confirmEvents.addEventListener(...args),
    click: confirmClick,
    removeEventListener: (...args: Parameters<EventTarget['removeEventListener']>) =>
      confirmEvents.removeEventListener(...args),
  },
  exibir: (p: { conteudo?: string; fnConfirmar?: string; tipo?: string }) => {
    if (p.tipo === 'confirm') {
      if (!active) throw new FrameGuardError('Confirmação sem uma ação autorizada');
      const fn = /getDocument\(\)\.(\w+)\(/.exec(String(p.fnConfirmar ?? ''))?.[1];
      const target = fn ? (page as unknown as Record<string, unknown>)[fn] : undefined;
      if (typeof target === 'function') target.call(page);
      else if (!fn && /Confirma a exclus/i.test(String(p.conteudo ?? ''))) {
        const id = active.id;
        confirmFor = id;
        later(() => {
          if (active?.id === id && confirmFor === id) confirmClick();
        });
      } else if (!fn && page.enviar) page.enviar();
      else throw new FrameGuardError('Confirmação do formulário não suportada no quadro isolado');
      return;
    }
    active?.msgs.push(
      String(p.conteudo ?? '')
        .replace(/<br\s*\/?>/gi, ' ')
        .trim(),
    );
    if (active && !active.posted) later(finish);
  },
};
const modal = {
  getDocument: () => page,
  recarregar: () => undefined,
  setarTitulo: () => undefined,
  setarUrl: () => {
    if (!renderingResponse)
      throw new FrameGuardError('Navegação do formulário fora do transporte recusada');
  },
};
Object.defineProperty(window, '__lattesFrameParent', {
  value: {
    autorDP: [],
    caixaMsg: box,
    checkPublicacao: () => undefined,
    fecharModal: () => undefined,
    modalCV1: modal,
    modalCV2: modal,
    modalCV3: modal,
    titularPessoaDP: [],
  },
});

function send(form: HTMLFormElement): void {
  if (!active || active.posted)
    throw new FrameGuardError('Envio do quadro sem uma ação autorizada');
  const pairs: [string, string][] = [];
  for (const [name, value] of new FormData(form)) {
    if (typeof value !== 'string')
      throw new FrameGuardError('Arquivo em formulário Dev não suportado');
    pairs.push([name, value]);
  }
  active.posted = true;
  port.postMessage({
    action: form.getAttribute('action') || '',
    id: active.id,
    method: form.method.toUpperCase(),
    pairs,
    type: 'post',
  });
}
HTMLFormElement.prototype.submit = function () {
  send(this);
};

function render(html: string): void {
  confirmFor = undefined;
  confirmEvents = new EventTarget();
  document.open();
  window.alert = (text?: unknown) => {
    if (active) box.exibir({ conteudo: String(text ?? '') });
  };
  window.prompt = () => null;
  window.confirm = () => true;
  document.addEventListener(
    'submit',
    (event) => {
      event.preventDefault();
      try {
        send(event.target as HTMLFormElement);
      } catch (error) {
        fail(error);
      }
    },
    true,
  );
  window.addEventListener('error', (event) => {
    if (event.error instanceof FrameGuardError || event.error?.name === 'SecurityError') {
      event.preventDefault();
      fail(event.error);
    }
  });
  // A política vem antes de qualquer script da página; a origem opaca permanece.
  document.write(html);
  document.close();
}

function run(id: number, command: FrameCommand): void {
  if (command.type === 'render') {
    render(command.html);
    later(() => reply(id));
  } else if (command.type === 'inspect') {
    reply(id, {
      ctr: (document.forms[0]?.elements.namedItem('f_ctr') as HTMLInputElement | null)?.value,
      forms: [...document.forms].map((form, index) => ({
        index,
        name: form.name,
        savable: !!saveButton(form.ownerDocument),
        signature: signature(form),
      })),
      text: (document.body?.innerText ?? '').replace(/\s+/g, ' ').trim(),
    });
  } else if (command.type === 'configure') {
    Object.assign(context, command.context);
    owner = command.owner;
    reply(id);
  } else if (command.type === 'fill') {
    const form =
      command.formIndex === undefined
        ? document.forms.namedItem(command.job.form)
        : document.forms[command.formIndex];
    if (!form) throw new Error(`A página não tem o formulário ${command.job.form}`);
    if (!ownerAdded) {
      addOwner(page, owner);
      ownerAdded = true;
    }
    const values = fill(page, form, command.job);
    reply(id, { signature: signature(form), values });
  } else if (command.type === 'action') {
    if (active) throw new Error('Ação concorrente no quadro Dev');
    confirmFor = undefined;
    active = { id, msgs: [], posted: false };
    if (command.action === 'save') {
      const button = saveButton(document);
      if (button) button.click();
      else if (page.check) page.check();
      else throw new Error('Sem como salvar nesta página');
    } else {
      const remove = command.action === 'deleteAtuacao' ? page.dele : page.del;
      if (!remove) throw new Error('Sem como excluir nesta página');
      remove.call(page);
    }
  }
}

const connect = (event: MessageEvent) => {
  if (
    event.source !== host ||
    event.data !== 'lattes-editor:frame-init' ||
    event.ports.length !== 1
  )
    return;
  event.stopImmediatePropagation();
  window.removeEventListener('message', connect);
  port = event.ports[0]!;
  port.onmessage = (message: MessageEvent) => {
    const m = message.data as { id: number; command?: FrameCommand; response?: string };
    try {
      if (typeof m.response === 'string') {
        if (!active || m.id !== active.id || !active.posted)
          throw new Error('Resposta inesperada do transporte');
        renderingResponse = true;
        try {
          render(m.response);
        } finally {
          renderingResponse = false;
        }
        setTimeout(finish, 1500);
      } else if (m.command) run(m.id, m.command);
    } catch (error) {
      if (active) fail(error);
      else
        reply(
          m.id,
          undefined,
          error instanceof Error ? error.message : String(error),
          fatalError(error),
        );
    }
  };
  port.postMessage({ type: 'ready' });
};
window.addEventListener('message', connect);
