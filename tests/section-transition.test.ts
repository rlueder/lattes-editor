import { describe, expect, it, vi } from 'vitest';

import { sectionTransitionsEnabled, withSectionTransition } from '../src/ui/section-transition.ts';

describe('troca de seção animada', () => {
  it('só anima com a API presente e sem movimento reduzido', () => {
    const doc = { startViewTransition: () => undefined };
    expect(sectionTransitionsEnabled(doc, false)).toBe(true);
    expect(sectionTransitionsEnabled(doc, true)).toBe(false);
    expect(sectionTransitionsEnabled({}, false)).toBe(false);
    expect(sectionTransitionsEnabled(undefined, false)).toBe(false);
  });

  it('sem transição, aplica a troca na hora', () => {
    const update = vi.fn();
    const start = vi.fn();
    withSectionTransition(update, false, { startViewTransition: start });
    expect(update).toHaveBeenCalledOnce();
    expect(start).not.toHaveBeenCalled();
  });

  it('sem a API, aplica a troca na hora mesmo se pedida', () => {
    const update = vi.fn();
    withSectionTransition(update, true, {});
    expect(update).toHaveBeenCalledOnce();
  });

  it('com a API, a troca roda dentro da transição, ligada ao documento', () => {
    const update = vi.fn();
    const doc = {
      startViewTransition: vi.fn(function (this: unknown, cb: () => void) {
        expect(this).toBe(doc);
        cb();
      }),
    };
    withSectionTransition(update, true, doc);
    expect(doc.startViewTransition).toHaveBeenCalledOnce();
    expect(update).toHaveBeenCalledOnce();
  });
});
