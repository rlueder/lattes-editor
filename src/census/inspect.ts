// A recaptura avulsa do censo (LAT-57): páginas que ainda não são entrada de
// targets.ts, abertas só com GET pela mesma leitura do censo (run.ts), com os
// scripts da página sem dado pessoal e os endereços que ela abre. Serve à
// lista de docs/lattes-formularios/recaptura.md.

import { findLinks, lattesIdFrom } from '../bridge/lattes-html.ts';
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
    // Com f_cod no caminho (um link copiado do Lattes), ele não entra de novo:
    // o gateway responde com erro a um parâmetro repetido (15/10/2026).
    const hasCode = Object.keys(params).some((k) => k.toLowerCase() === 'f_cod');
    const target: CensusTarget = {
      elements: [],
      elementsProvenance: 'inferido',
      id: `avulsa-${i + 1}`,
      itemKey: 'f_seq',
      label: publicPath(proc, params),
      locate: { kind: 'fixed', params, proc, ...(noCode || hasCode ? { noCode: true } : {}) },
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

/** As naturezas de selecionarNatureza() (docs/lattes_internals.md, seção 17). */
export const ACTIVITY_NATURES = ['1', '2', '4', '5', '6', '7', '8', '9', 'B'];

/**
 * O formulário de atividade de cada natureza, numa atuação do currículo: a
 * lista de atuações do menu, a tela de cargos e vínculos da primeira atuação
 * que tiver o link de atividade (pkg_ativ.cargo) e esse link com cada
 * natureza. Os códigos da atuação vêm dos links e ficam fora do arquivo.
 */
export async function inspectActivities(
  port: CensusPort,
  code: string,
  options: Pick<CensusOptions, 'collector' | 'delayMs' | 'now' | 'redact'> = {},
): Promise<CensusFile> {
  const reader = new CensusReader(port, code, options.delayMs ?? 300);
  const lista = findLinks(await reader.menuHtml(), 'pkg_ativ.lista')[0];
  if (!lista) throw new Error('A lista de atuações não está no menu');
  const grids = findLinks((await reader.get(lista.path)).html, 'pkg_ativ.cargos_vinculos');
  for (const grid of grids) {
    const cargo = findLinks((await reader.get(grid.path)).html, 'pkg_ativ.cargo').find(
      (l) => !l.params.f_seq_funcao,
    );
    if (!cargo) continue;
    const base = cargo.path.replace(/([?&])f_natur_ativ=[^&]*/i, '$1').replace(/[?&]$/, '');
    const join = base.includes('?') ? '&' : '?';
    return inspectPages(
      port,
      code,
      ACTIVITY_NATURES.map((n) => `${base}${join}f_natur_ativ=${n}`),
      options,
    );
  }
  throw new Error('Nenhuma atuação tem o link de inclusão de atividade');
}
