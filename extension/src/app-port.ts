// Ligação nativa com o app; mensagens e identidade do currículo ficam no worker.
import { bridgeMessage, type EditorMessage, isEditorMessage } from '../../src/bridge/protocol.ts';
import { APP_KEY } from './state.ts';

export class AppPort {
  private port?: chrome.runtime.Port;
  private host: string;
  private receive: (message: EditorMessage) => void;
  constructor(host: string, receive: (message: EditorMessage) => void) {
    this.host = host;
    this.receive = receive;
  }
  get connected(): boolean {
    return this.port !== undefined;
  }
  send(message: Parameters<typeof bridgeMessage>[0]): void {
    this.port?.postMessage(bridgeMessage(message));
  }
  connect(): void {
    if (this.port || !this.host) return;
    try {
      this.port = chrome.runtime.connectNative(this.host);
    } catch {
      return;
    }
    this.port.onMessage.addListener((data) => {
      if (isEditorMessage(data)) this.receive(data);
    });
    this.port.onDisconnect.addListener(() => {
      void chrome.runtime.lastError;
      this.port = undefined;
      void chrome.storage.session.remove(APP_KEY).catch(() => undefined);
    });
  }
}
