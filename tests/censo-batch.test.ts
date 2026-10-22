import { expect, it } from 'vitest';

import { TEST_BATCH_LIMIT, testBatchSize } from '../extension/src/censo-batch.ts';
it('reserva tempo para conferência com lotes de até três itens', () => {
  expect(TEST_BATCH_LIMIT).toBe(3);
  expect(testBatchSize()).toBe(3);
  for (const n of [0, -1, 4, 50, Infinity, NaN, 1.5])
    expect(() => testBatchSize(n)).toThrow('1 a 3');
});
