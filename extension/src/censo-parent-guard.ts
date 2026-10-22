// Defesa para as chamadas usuais da página do Lattes. O quadro continua de
// mesma origem; isto não isola JavaScript arbitrário nem referências nativas antigas.
import { CensusStopped } from '../../src/census/stop.ts';

export function protectParent(stop: (error: Error) => void): () => void {
  if (typeof window === 'undefined') return () => undefined;
  const page = window as Window & typeof globalThis;
  const previous = new Map<string, PropertyDescriptor | undefined>();
  const restore = () => {
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(page, key, descriptor);
      else Reflect.deleteProperty(page, key);
    }
  };
  const replace = (key: string, value: unknown) => {
    previous.set(key, Object.getOwnPropertyDescriptor(page, key));
    Object.defineProperty(page, key, {
      configurable: true,
      enumerable: true,
      value,
      writable: false,
    });
  };
  const blocked = (): never => {
    const error = new CensusStopped('O formulário tentou rede fora da ponte; a tarefa parou');
    stop(error);
    throw error;
  };
  try {
    if (typeof page.fetch === 'function') replace('fetch', async () => blocked());
    if (typeof page.XMLHttpRequest === 'function')
      replace('XMLHttpRequest', new Proxy(page.XMLHttpRequest, { construct: blocked }));
    if (typeof page.open === 'function') replace('open', blocked);
    return restore;
  } catch (error) {
    restore();
    throw error;
  }
}
