// Aviso e consentimento antes do primeiro uso (política da Chrome Web Store
// para dados de quem usa). Enquanto não houver um "ok" para a versão atual do
// aviso, a extensão não lê nem grava nada no Lattes.

/** Sobe quando o aviso muda de sentido; quem aceitou a versão anterior vê de novo. */
export const CONSENT_VERSION = 1;

export const CONSENT_KEY = 'consentimento';

export const PRIVACY_URL = 'https://rlueder.github.io/lattes-editor/privacidade.html';

export interface Consent {
  at: string;
  version: number;
}

/** O que está guardado vale como consentimento para o aviso atual? */
export function isConsentCurrent(stored: unknown): boolean {
  if (!stored || typeof stored !== 'object') return false;
  const { version } = stored as Partial<Consent>;
  return version === CONSENT_VERSION;
}

export function consentRecord(now: Date = new Date()): Consent {
  return { at: now.toISOString(), version: CONSENT_VERSION };
}

export async function hasConsent(): Promise<boolean> {
  const stored = await chrome.storage.local.get(CONSENT_KEY);
  return isConsentCurrent(stored[CONSENT_KEY]);
}

export async function giveConsent(): Promise<void> {
  await chrome.storage.local.set({ [CONSENT_KEY]: consentRecord() });
}
