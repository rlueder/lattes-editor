// Entrada usada só pelo teste de navegador, sem instalar capacidades de depuração no censo.
import { frameCommand, frameState, openFrame } from '../extension/src/censo-frame.ts';
import { fillFrame, inspectFrame, submit } from '../extension/src/censo-submit.ts';
import { context } from '../extension/src/censo-test-donors.ts';
import { censusTraffic } from '../extension/src/censo-traffic.ts';

async function run(mode: string) {
  let uncertain = false;
  return censusTraffic
    .run(async () => {
      let frame: HTMLIFrameElement | undefined;
      try {
        frame = await openFrame(
          `pkg_isolation.form?mode=${mode}&target=${encodeURIComponent(`${location.origin}/cvlattesweb/pkg_isolation.bypass`)}`,
          'SINTETICO1',
        );
        const sandbox = frame.getAttribute('sandbox');
        const opaque = frame.contentDocument === null;
        if (mode === 'escapes' || mode === 'navigate') {
          const info = await inspectFrame(frame);
          await censusTraffic.wait(500);
          return { info, opaque, sandbox };
        }
        context.donors = {
          OTHER: { f_inst: 'Doador errado' },
          TEST: { f_inst: 'Doador original' },
        };
        const job = { form: 'TEST', id: 'sintetico', path: '', tag: 'sintetico-v1', variant: 0 };
        const owner = { l: 'Autor Sintético', t: 'SINTÉTICO, A.' };
        if (mode === 'clone') {
          try {
            await frameCommand(frame, {
              context,
              owner: { l: () => undefined } as unknown as Record<string, string>,
              type: 'configure',
            });
            throw new Error('Clonagem inválida foi aceita');
          } catch (error) {
            if (!(error instanceof DOMException) || error.name !== 'DataCloneError') throw error;
          }
        }
        if (mode !== 'delete') await fillFrame(frame, job, context, owner);
        const pending = submit(frame, mode === 'delete' ? 'delete' : 'save');
        const timer =
          mode === 'cancel' ? setTimeout(() => censusTraffic.cancel(), 1100) : undefined;
        let msgs: string[];
        try {
          msgs = await pending;
        } finally {
          clearTimeout(timer);
        }
        if (mode === 'step' || mode === 'unnamed') {
          const info = await inspectFrame(frame);
          const target = info.forms.find(
            (form) => form.name === (mode === 'unnamed' ? '' : 'STEP2'),
          );
          if (!target) throw new Error('Segundo passo ausente');
          context.donors.TEST!.f_inst = 'Alterado depois da configuração';
          await fillFrame(frame, job, context, undefined, target.index);
          msgs = await submit(frame, 'save');
        }
        return { msgs, opaque, sandbox, submitted: frameState(frame).submitted };
      } catch (error) {
        uncertain = frame ? frameState(frame).submitted : false;
        return {
          error: error instanceof Error ? error.message : String(error),
          uncertain: frame ? frameState(frame).submitted : false,
        };
      } finally {
        frame?.remove();
      }
    })
    .catch((error: unknown) => ({
      error: error instanceof Error ? error.message : String(error),
      uncertain,
    }));
}
(globalThis as unknown as { __isolationTest: typeof run }).__isolationTest = run;
