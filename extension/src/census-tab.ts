// Chamadas longas do censo Dev, separadas das operações do conector normal.
import { untilTabCloses } from './tab-guard.ts';

/** O prazo interno cancela rede e quadros antes de a chamada externa desistir. */
const TEST_ITEMS_TIMEOUT_MS = 160_000;

type CensusAction = 'andamento' | 'criar' | 'preparar' | 'remover';

/**
 * Os itens de teste no mundo da página (test-items-run.ts, só no canal Dev):
 * injeta o censo uma vez por carregamento do menu (ou quando o da aba é de
 * outra montagem) e roda a ação pedida.
 */
export async function runCensusInPage(
  tabId: number,
  action: CensusAction,
  options: { batch?: number; dryRun?: boolean; retryFailed?: boolean; unmarked?: string[] },
): Promise<{ error?: string; result?: unknown }> {
  const long = async <T>(start: () => Promise<T>) => {
    try {
      return await untilTabCloses(tabId, start, chrome.tabs.onRemoved, TEST_ITEMS_TIMEOUT_MS);
    } catch (err) {
      await chrome.scripting
        .executeScript({
          func: () => {
            (globalThis as { __lattesCensus?: { cancel?(): void } }).__lattesCensus?.cancel?.();
          },
          target: { tabId },
          world: 'MAIN',
        })
        .catch(() => undefined);
      throw err;
    }
  };
  // Um censo de uma montagem anterior (a aba seguiu aberta enquanto a extensão
  // recarregava) é trocado: antes ele ficava, e o lote corria com o código velho.
  const [loaded] = await long(() =>
    chrome.scripting.executeScript({
      args: [__CENSUS_BUILD__],
      func: (build: string) =>
        (globalThis as { __lattesCensus?: { build?: unknown } }).__lattesCensus?.build === build,
      target: { tabId },
      world: 'MAIN',
    }),
  );
  if (!loaded?.result) {
    await long(() =>
      chrome.scripting.executeScript({
        files: ['censo-lattes.js'],
        target: { tabId },
        world: 'MAIN',
      }),
    );
  }
  const [res] = await long(() =>
    chrome.scripting.executeScript({
      args: [action, options] as [CensusAction, typeof options],
      func: async (acao: CensusAction, opts: typeof options) => {
        type Fn = (o?: unknown) => unknown;
        const c = (globalThis as unknown as { __lattesCensus: Record<string, Fn> }).__lattesCensus;
        try {
          const run =
            acao === 'preparar'
              ? c.prepareTestItems!()
              : acao === 'criar'
                ? c.testItems!(opts)
                : acao === 'remover'
                  ? c.removeTestItems!(opts)
                  : c.testProgress!();
          return { result: JSON.parse(JSON.stringify(await run)) as unknown };
        } catch (err) {
          return { error: err instanceof Error ? err.message : String(err) };
        }
      },
      target: { tabId },
      world: 'MAIN',
    }),
  );
  return res?.result ?? { error: 'A aba do Lattes não respondeu' };
}
