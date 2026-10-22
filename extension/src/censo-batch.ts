export const TEST_BATCH_LIMIT = 3;
export function testBatchSize(value = TEST_BATCH_LIMIT): number {
  if (!Number.isInteger(value) || value < 1 || value > TEST_BATCH_LIMIT)
    throw new Error('Use lotes de 1 a 3 itens para reservar tempo para a conferência');
  return value;
}
