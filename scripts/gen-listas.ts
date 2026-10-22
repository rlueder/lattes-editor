// Gera src/schema/listas-lattes.json, as listas que o editor oferece nos campos
// tipados (LAT-48), a partir da captura dos formulários do próprio Lattes em
// docs/lattes-listas/ e, para as UFs, do censo em docs/lattes-formularios/.
// Só entram listas cujo formato no XML foi conferido numa exportação real (ver
// docs/campos_tipados.md, "Achados").
//
//   node scripts/gen-listas.ts

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { format, resolveConfig } from 'prettier';

const root = fileURLToPath(new URL('../', import.meta.url));
const CAPTURE = 'docs/lattes-listas/captura-2026-10-13.json';

interface Capture {
  capturedAt: string;
  forms: { selects: { list: string; name: string }[] }[];
  lists: Record<string, string[]>;
}

const capture = JSON.parse(readFileSync(root + CAPTURE, 'utf8')) as Capture;

/**
 * O censo de 15/10/2026 (docs/lattes-formularios/): as UFs do formulário de
 * identificação (f_uf_nasc, a mesma lista de f_uf_rg), código e rótulo iguais.
 */
const CENSUS = 'docs/lattes-formularios/censo-2026-10-15.json';
const census = JSON.parse(readFileSync(root + CENSUS, 'utf8')) as {
  lists: Record<string, { label: string; value: string }[]>;
};
const ufs = (census.lists.f_uf_nasc ?? []).map((o) => o.value).filter(Boolean);
// Sem a lista (outro nome no censo, por exemplo), o editor perderia as UFs calado.
if (ufs.length !== 27) {
  throw new Error(`${CENSUS}: esperava as 27 UFs em lists.f_uf_nasc, achei ${ufs.length}`);
}

/** A lista de um controle (pelo nome no formulário), a mais longa entre os formulários. */
function listOf(control: string): string[] {
  const ids = capture.forms.flatMap((f) =>
    f.selects.filter((s) => s.name === control).map((s) => s.list),
  );
  const lists = ids.map((id) => capture.lists[id] ?? []);
  return lists.sort((a, b) => b.length - a.length)[0] ?? [];
}

/** Nomes na ordem do Lattes (os mais usados primeiro), sem vazios nem repetidos. */
function names(control: string): string[] {
  const seen = new Set<string>();
  return listOf(control)
    .map((o) => o.split('|').slice(1).join('|').trim())
    .filter((n) => n && !seen.has(n) && seen.add(n));
}

/**
 * Nome → código das opções de um combo ("Brasil" → "BRA"). Nome com mais de um
 * código no Lattes (República Tcheca: RTC e TCH) fica de fora: não há como
 * saber qual o currículo usa.
 */
function codes(control: string): Record<string, string> {
  const found = new Map<string, Set<string>>();
  for (const option of listOf(control)) {
    const [code = '', ...rest] = option.split('|');
    const name = rest.join('|').trim();
    if (!code.trim() || !name) continue;
    found.set(name, (found.get(name) ?? new Set()).add(code.trim()));
  }
  return Object.fromEntries(
    [...found]
      .filter(([, set]) => set.size === 1)
      .map(([name, set]) => [name, [...set][0]!])
      .sort(([a], [b]) => a!.localeCompare(b!, 'pt-BR')),
  );
}

/** Os códigos de F_IDIOMA, conferidos contra os que F_COD_IDIOMA lista. */
function languageCodes(): Record<string, string> {
  const all = codes('F_IDIOMA');
  const section = codes('F_COD_IDIOMA');
  const different = Object.entries(section).filter(([name, code]) => all[name] !== code);
  if (Object.keys(section).length === 0 || different.length > 0) {
    throw new Error(
      `F_COD_IDIOMA e F_IDIOMA discordam em ${JSON.stringify(different)}; confira a captura antes de gerar`,
    );
  }
  return all;
}

const out = {
  capturedAt: capture.capturedAt,
  /**
   * Nome e código de duas letras de cada idioma, para a seção Idiomas (o XML
   * guarda o código em IDIOMA e o nome em DESCRICAO-DO-IDIOMA: EN Inglês, ES
   * Espanhol na exportação real). Vem de F_IDIOMA, o combo das produções, que
   * tem os 152; F_COD_IDIOMA, o combo do formulário de idioma, foi capturado
   * num currículo que já tinha alemão, espanhol e inglês, e o Lattes tira do
   * combo os idiomas já cadastrados. Os 149 que ele lista têm o mesmo código
   * em F_IDIOMA (conferido abaixo).
   */
  codigosDosIdiomas: languageCodes(),
  /**
   * f_pais: o código que o formulário envia para cada nome (BRA para Brasil),
   * para o conector gravar o país de um item (LAT-51).
   */
  codigosDosPaises: codes('f_pais'),
  /** F_IDIOMA: nas produções, o XML guarda o nome (Português na exportação real). */
  idiomas: names('F_IDIOMA'),
  /** f_pais: o XML guarda o nome (Brasil, Argentina, Portugal na exportação real). */
  paises: names('f_pais'),
  source: CAPTURE,
  /** f_uf_nasc e f_uf_rg: o XML guarda a sigla (RS na exportação real, 15/10/2026). */
  ufs,
  ufsSource: CENSUS,
};
// Formatado pelo Prettier, senão o format:check e o gerador se reprovam.
const path = `${root}src/schema/listas-lattes.json`;
writeFileSync(
  path,
  await format(JSON.stringify(out), { ...(await resolveConfig(path)), filepath: path }),
);
console.log(
  `src/schema/listas-lattes.json: ${out.paises.length} países (${Object.keys(out.codigosDosPaises).length} com código), ${out.idiomas.length} idiomas (${Object.keys(out.codigosDosIdiomas).length} com código), ${out.ufs.length} UFs`,
);
