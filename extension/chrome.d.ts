// Tipos mínimos das APIs de extensão usadas pelo conector, escritos à mão para
// não trazer @types/chrome. Só o que o código chama.

declare namespace chrome {
  namespace runtime {
    interface MessageSender {
      tab?: tabs.Tab;
    }
    function sendMessage(message: unknown): Promise<unknown>;
    const onMessage: {
      addListener(
        cb: (
          message: unknown,
          sender: MessageSender,
          sendResponse: (response?: unknown) => void,
        ) => boolean | void,
      ): void;
    };
    const onInstalled: { addListener(cb: (details: { reason: string }) => void): void };
    const onStartup: { addListener(cb: () => void): void };
    const lastError: { message?: string } | undefined;
    interface Port {
      disconnect(): void;
      postMessage(message: unknown): void;
      onDisconnect: { addListener(cb: () => void): void };
      onMessage: { addListener(cb: (message: unknown) => void): void };
    }
    /** Mensagens nativas: inicia o host registrado no sistema (o app de desktop). */
    function connectNative(application: string): Port;
    function getManifest(): { version: string; version_name?: string };
    /** Recarrega a extensão, lendo de novo os arquivos (a descompactada lê da pasta). */
    function reload(): void;
    function getURL(path: string): string;
  }

  namespace tabs {
    interface Tab {
      id?: number;
      url?: string;
    }
    function query(q: { url?: string | string[] }): Promise<Tab[]>;
    function reload(tabId: number): Promise<void>;
    function sendMessage(tabId: number, message: unknown): Promise<unknown>;
    function create(props: { url: string }): Promise<Tab>;
    const onUpdated: {
      addListener(cb: (tabId: number, info: { status?: string }, tab: Tab) => void): void;
    };
    /** Sem a permissão "tabs": o evento só traz o id da aba que fechou. */
    const onRemoved: {
      addListener(cb: (tabId: number) => void): void;
      removeListener(cb: (tabId: number) => void): void;
    };
  }

  namespace scripting {
    interface InjectionResult<T> {
      result?: T;
    }
    function executeScript<A extends unknown[], T>(injection: {
      args?: A;
      files?: string[];
      func?: (...args: A) => T | Promise<T>;
      target: { tabId: number };
      /** MAIN: no mundo da página, com os objetos e funções dela. */
      world?: 'ISOLATED' | 'MAIN';
    }): Promise<InjectionResult<Awaited<T>>[]>;
  }

  namespace declarativeNetRequest {
    function updateSessionRules(options: {
      removeRuleIds: number[];
      addRules: {
        id: number;
        priority: number;
        action: { type: 'block' };
        condition: { tabIds: number[]; resourceTypes: ['sub_frame']; urlFilter: string };
      }[];
    }): Promise<void>;
  }

  namespace storage {
    interface Area {
      get(keys?: string | string[] | null): Promise<Record<string, unknown>>;
      remove(keys: string | string[]): Promise<void>;
      set(items: Record<string, unknown>): Promise<void>;
    }
    const local: Area;
    const session: Area;
    const onChanged: { addListener(cb: (changes: object, area: string) => void): void };
  }

  namespace sidePanel {
    function setPanelBehavior(behavior: { openPanelOnActionClick: boolean }): Promise<void>;
  }

  namespace alarms {
    function create(name: string, info: { periodInMinutes: number }): Promise<void>;
    const onAlarm: { addListener(cb: (alarm: { name: string }) => void): void };
  }

  namespace offscreen {
    function createDocument(params: {
      justification: string;
      reasons: string[];
      url: string;
    }): Promise<void>;
    function hasDocument(): Promise<boolean>;
  }

  namespace action {
    function setBadgeText(details: { text: string }): Promise<void>;
    function setIcon(details: { path: Record<string, string> }): Promise<void>;
    const onClicked: { addListener(cb: () => void): void };
  }
}

/** Nome do host nativo, definido na montagem (scripts/build-extension.ts). */
declare const __NATIVE_HOST__: string;

/** Montagem do canal Dev (scripts/build-extension.ts --canal-dev). */
declare const __CANAL_DEV__: boolean;

/** Marca da montagem do censo, a mesma no service worker (scripts/build-extension.ts). */
declare const __CENSUS_BUILD__: string;
