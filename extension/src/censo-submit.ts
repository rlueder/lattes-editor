import type { TestJob } from '../../src/census/test-plan.ts';
import { frameCommand } from './censo-frame.ts';
import type { FilledFrame, FrameAction, FrameInfo } from './censo-frame-protocol.ts';
import type { context } from './censo-test-donors.ts';

export const inspectFrame = (frame: HTMLIFrameElement) =>
  frameCommand<FrameInfo>(frame, { type: 'inspect' });
const configured = new WeakSet<HTMLIFrameElement>();
export const fillFrame = async (
  frame: HTMLIFrameElement,
  job: TestJob,
  data: typeof context,
  owner?: Record<string, string>,
  formIndex?: number,
) => {
  if (!configured.has(frame)) {
    await frameCommand(frame, { context: data, owner, type: 'configure' });
    configured.add(frame);
  }
  return frameCommand<FilledFrame>(frame, { formIndex, job, type: 'fill' });
};
/** O pai autoriza uma gravação por ação; funções e DOM ficam no quadro isolado. */
export const submit = (frame: HTMLIFrameElement, action: FrameAction) =>
  frameCommand<string[]>(frame, { action, type: 'action' });
