// Prévia dos passos do primeiro uso no `pnpm dev`, sem depender da extensão:
// ?primeiro-uso=<estado> fixa a ligação e o pedido (onboarding.ts).

import { BRIDGE_FEATURES } from '../bridge/compat.ts';
import type { Link } from '../bridge/link.ts';
import type { OpenState } from '../ui/lattes-open.ts';

const ALL = [...BRIDGE_FEATURES];
const v = '0.0.0';

const PREVIEWS: Record<string, { link: Link; open: OpenState }> = {
  abrindo: {
    link: { features: ALL, state: { kind: 'lido', version: v } },
    open: { kind: 'abrindo' },
  },
  antiga: {
    link: { features: ['estado-lattes'], state: { kind: 'lendo', version: v } },
    open: { kind: 'parado' },
  },
  aviso: {
    link: { features: ALL, state: { kind: 'sem-leitura', reason: 'consentimento', version: v } },
    open: { kind: 'parado' },
  },
  lattes: {
    link: { features: ALL, state: { kind: 'sem-leitura', reason: 'sem-aba', version: v } },
    open: { kind: 'falhou', reason: 'sem-aba' },
  },
  pendente: {
    link: { features: ALL, state: { kind: 'lido', version: v } },
    open: { kind: 'falhou', reason: 'pendente' },
  },
  procurando: { link: { state: { kind: 'procurando' } }, open: { kind: 'parado' } },
  'sem-extensao': { link: { state: { kind: 'sem-extensao' } }, open: { kind: 'parado' } },
};

export function onboardingPreview(search: string): { link: Link; open: OpenState } | undefined {
  const name = new URLSearchParams(search).get('primeiro-uso');
  return name ? PREVIEWS[name] : undefined;
}
