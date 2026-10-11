// Tipos mínimos das APIs de extensão usadas pela ponte, escritos à mão para
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
    const onInstalled: { addListener(cb: () => void): void };
    function getManifest(): { version: string };
    function getURL(path: string): string;
  }

  namespace tabs {
    interface Tab {
      id?: number;
      url?: string;
    }
    function query(q: { url?: string | string[] }): Promise<Tab[]>;
    function sendMessage(tabId: number, message: unknown): Promise<unknown>;
    function create(props: { url: string }): Promise<Tab>;
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
    }): Promise<InjectionResult<Awaited<T>>[]>;
  }

  namespace storage {
    interface Area {
      get(keys?: string | string[] | null): Promise<Record<string, unknown>>;
      set(items: Record<string, unknown>): Promise<void>;
    }
    const session: Area;
    const onChanged: { addListener(cb: (changes: object, area: string) => void): void };
  }

  namespace sidePanel {
    function setPanelBehavior(behavior: { openPanelOnActionClick: boolean }): Promise<void>;
  }

  namespace action {
    function setBadgeText(details: { text: string }): Promise<void>;
    const onClicked: { addListener(cb: () => void): void };
  }
}
