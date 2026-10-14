// O que cada procedimento do Lattes simulado recebe e devolve.

import type { LattesState } from './estado.ts';
import type { SimRequest } from './pedido.ts';

export type SimResponse =
  /** Bytes (o ZIP do Exportar, a foto). */
  | { bytes: Uint8Array; contentType: string; headers?: Record<string, string>; status?: number }
  /** A ligação cai sem resposta: o fetch da página vê "Failed to fetch". */
  | { cut: true }
  /** HTML ou texto, enviado em Latin-1 como o Lattes faz. */
  | { contentType?: string; headers?: Record<string, string>; html: string; status?: number };

export type Handler = (req: SimRequest, state: LattesState) => SimResponse | Promise<SimResponse>;

/** Procedimentos por nome em minúsculas (o gateway não distingue caixa). */
export type Routes = Record<string, Handler>;

export const html = (body: string, status = 200): SimResponse => ({ html: body, status });

export const notFound = (proc: string): SimResponse => ({
  html: `<html><body><h1>Not Found</h1><p>${proc}</p></body></html>`,
  status: 404,
});
