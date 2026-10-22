import type { TestJob } from '../../src/census/test-plan.ts';
import type { context } from './censo-test-donors.ts';

export type FrameWindow = Window & {
  autorGrid?: { getProvider: () => Record<string, unknown>[] };
  check?: () => void;
  del?: () => void;
  dele?: () => void;
  enviar?: () => void;
};
export type FrameAction = 'save' | 'delete' | 'deleteAtuacao';
export type FrameCommand =
  | { type: 'render'; html: string }
  | { type: 'inspect' }
  | { type: 'configure'; context: typeof context; owner?: Record<string, string> }
  | { type: 'fill'; job: TestJob; formIndex?: number }
  | { type: 'action'; action: FrameAction };
export interface FrameInfo {
  ctr?: string;
  forms: { index: number; name: string; signature: string; savable: boolean }[];
  text: string;
}
export interface FilledFrame {
  signature: string;
  values: Record<string, string>;
}
export const FRAME_POLICY =
  "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; form-action 'none'; frame-src 'none'; connect-src 'none'; base-uri 'none'; object-src 'none'";

/** Valida dados recebidos do quadro, que não recebe uma capacidade de rede genérica. */
export function framePost(raw: unknown, base: string): { url: URL; pairs: [string, string][] } {
  const m = raw as { action?: unknown; method?: unknown; pairs?: unknown } | null;
  if (!m || typeof m.action !== 'string' || m.method !== 'POST' || !Array.isArray(m.pairs))
    throw new Error('Envio inválido do quadro Dev');
  const url = new URL(m.action, base);
  if (url.origin !== new URL(base).origin || url.username || url.password)
    throw new Error('Destino externo do quadro Dev recusado');
  let size = 0;
  if (m.pairs.length > 10_000) throw new Error('Campos demais no quadro Dev');
  const pairs = m.pairs.map((pair: unknown): [string, string] => {
    if (!Array.isArray(pair) || pair.length !== 2 || pair.some((v) => typeof v !== 'string'))
      throw new Error('Campo inválido do quadro Dev');
    const [name, value] = pair as [string, string];
    size += name.length + value.length;
    if (size > 2 * 1024 * 1024) throw new Error('Formulário Dev grande demais');
    return [name, value];
  });
  return { pairs, url };
}

/** Só os acessos de interface conhecidos ganham uma cópia local, sem acesso ao pai real. */
export function localFrameReferences(code: string): string {
  return code.replace(
    /\b(?:(?:self|window)\.)?(?:parent|top)\.(caixaMsg|modalCV[1-3]|autorDP|titularPessoaDP|checkPublicacao|fecharModal)\b/g,
    '__lattesFrameParent.$1',
  );
}
