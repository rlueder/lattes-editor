// A recaptura avulsa do censo (LAT-57): páginas que ainda não são entrada de
// targets.ts, abertas só com GET pela mesma leitura do censo (run.ts), com os
// scripts da página sem dado pessoal e os endereços que ela abre. Serve à
// lista de docs/lattes-formularios/recaptura.md.

import { lattesIdFrom } from '../bridge/lattes-html.ts';
import { publicPath } from './census-page.ts';
import {
  type CensusEntry,
  type CensusFile,
  type CensusOptions,
  type CensusPort,
  CensusReader,
  pending,
  readEntry,
  shareLists,
  shareScripts,
  splitAtQuery,
} from './run.ts';
import type { CensusTarget } from './targets.ts';

/**
 * Abre, só com GET, páginas avulsas que o censo ainda não tem como entrada (a
 * recaptura de docs/lattes-formularios/recaptura.md): guarda o formulário, os
 * scripts sem dado pessoal e os endereços do Lattes que cada página abre. O
 * caminho vai sem f_cod; o código do currículo entra aqui. O arquivo não é um
 * censo versionado: as entradas não estão em targets.ts.
 */
export async function inspectPages(
  port: CensusPort,
  code: string,
  paths: (string | { noCode?: boolean; path: string })[],
  options: Pick<CensusOptions, 'collector' | 'delayMs' | 'now' | 'redact'> = {},
): Promise<CensusFile> {
  const reader = new CensusReader(port, code, options.delayMs ?? 300);
  const lattesId = lattesIdFrom(await reader.menuHtml().catch(() => ''));
  const redact = [...(options.redact ?? []), code, ...(lattesId ? [lattesId] : [])];
  const entries: (CensusEntry & { scriptText?: string[] })[] = [];
  let interrupted = false;
  for (const [i, item] of paths.entries()) {
    const { noCode, path } = typeof item === 'string' ? { noCode: false, path: item } : item;
    const [proc, query] = splitAtQuery(path);
    const params: Record<string, string> = {};
    for (const part of query.split('&').filter(Boolean)) {
      const eq = part.indexOf('=');
      params[eq < 0 ? part : part.slice(0, eq)] = eq < 0 ? '' : part.slice(eq + 1);
    }
    const target: CensusTarget = {
      elements: [],
      elementsProvenance: 'inferido',
      id: `avulsa-${i + 1}`,
      itemKey: 'f_seq',
      label: publicPath(proc, params),
      locate: { kind: 'fixed', params, proc, ...(noCode ? { noCode } : {}) },
      provenance: 'inferido',
      source: 'recaptura avulsa',
    };
    if (interrupted) {
      entries.push({ ...pending(target), status: 'nao-lido' });
      continue;
    }
    try {
      entries.push(await readEntry(reader, target, redact, code, { links: true, scripts: true }));
    } catch {
      interrupted = true;
      entries.push({ ...pending(target), status: 'nao-lido' });
    }
  }
  const scripts = shareScripts(entries);
  return {
    capturedAt: (options.now?.() ?? new Date()).toISOString(),
    collector: options.collector ?? 'lattes-editor',
    entries,
    format: 1,
    ...(interrupted ? { interrupted: true } : {}),
    lists: shareLists(entries),
    origin: 'cvlattesweb: páginas avulsas abertas por GET, sem enviar (recaptura)',
    ...(scripts ? { scripts } : {}),
  };
}
