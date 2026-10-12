import { describe, expect, it } from 'vitest';

import { CONSENT_VERSION, consentRecord, isConsentCurrent } from '../extension/src/consent.ts';

describe('consentimento antes do primeiro uso', () => {
  it('só vale o registro da versão atual do aviso', () => {
    expect(isConsentCurrent(undefined)).toBe(false);
    expect(isConsentCurrent(null)).toBe(false);
    expect(isConsentCurrent('sim')).toBe(false);
    expect(isConsentCurrent({ at: '2026-10-12T00:00:00.000Z' })).toBe(false);
    expect(isConsentCurrent({ at: '2026-10-12T00:00:00.000Z', version: CONSENT_VERSION - 1 })).toBe(
      false,
    );
    expect(isConsentCurrent(consentRecord())).toBe(true);
  });

  it('registra a data e a versão aceita', () => {
    const record = consentRecord(new Date('2026-10-12T21:00:00.000Z'));
    expect(record).toEqual({ at: '2026-10-12T21:00:00.000Z', version: CONSENT_VERSION });
  });
});
