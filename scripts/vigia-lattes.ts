// Vigia do Lattes: confere, sem login, o que o CNPq expõe ao público e de
// que o editor depende. O CNPq não publica roadmap nem changelog, então a
// única maneira de saber que algo mudou é olhar de tempos em tempos. O que
// fica atrás da sessão do usuário (menu, formulários, campos) é conferido
// pela extensão, em src/bridge/contract.ts; aqui só o que é público.
//
//   node scripts/vigia-lattes.ts [--saida relatorio.md] [--guardar pasta]
//
// Sai com 1 quando alguma conferência falha. O relatório é Markdown, para o
// resumo do job e para a issue que o workflow abre.

import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const root = new URL('../', import.meta.url).pathname;

/** Página do Extrator Lattes, onde o CNPq publica o XSD e diz quando o atualizou. */
const EXTRACAO_URL = 'https://memoria.cnpq.br/web/portal-lattes/extracoes-de-dados';
/** O XSD em si, linkado dessa página (observado em 12/10/2026). */
const XSD_URL = 'https://memoria.cnpq.br/documents/313759/1ee5aab5-84eb-4551-8dc2-c99764423c33';
/** O que a página diz hoje sobre o XSD; se o texto mudar, o CNPq mexeu no schema. */
const XSD_DATE_MARKER = 'atualizado em 12/09/2022';
const XSD_LOCAL = `${root}schema/CurriculoLattes_12_09_2022.xsd`;
/** A foto do perfil, que o editor carrega com o código do currículo (src/ui/profile.ts). */
const FOTO_URL = 'https://servicosweb.cnpq.br/wspessoa/servletrecuperafoto?tipo=1&id=K4000000A0';
/** Entrada do Lattes e menu do editor (sem sessão, o menu manda para a entrada). */
const LATTES_URL = 'https://lattes.cnpq.br/';
const MENU_URL = 'https://wwws.cnpq.br/cvlattesweb/PKG_MENU.menu';

interface Check {
  detail: string;
  name: string;
  ok: boolean;
}

const UA = 'lattes-editor vigia (https://github.com/rlueder/lattes-editor)';

async function fetchBytes(url: string): Promise<{ bytes: Uint8Array; res: Response }> {
  const res = await fetch(url, { headers: { 'user-agent': UA }, redirect: 'follow' });
  return { bytes: new Uint8Array(await res.arrayBuffer()), res };
}

const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

async function checkXsd(saveTo?: string): Promise<Check> {
  const local = new Uint8Array(readFileSync(XSD_LOCAL));
  const { bytes, res } = await fetchBytes(XSD_URL);
  if (!res.ok)
    return { detail: `HTTP ${res.status} em ${XSD_URL}`, name: 'XSD publicado', ok: false };
  const same = sha256(bytes) === sha256(local);
  if (!same && saveTo) {
    mkdirSync(saveTo, { recursive: true });
    writeFileSync(`${saveTo}/CurriculoLattes_remoto.xsd`, bytes);
  }
  return {
    detail: same
      ? `igual ao do repositório (${bytes.length} bytes, sha256 ${sha256(bytes).slice(0, 12)}…)`
      : `DIFERENTE do repositório: ${bytes.length} bytes (local ${local.length}), sha256 ${sha256(bytes).slice(0, 12)}… (local ${sha256(local).slice(0, 12)}…). Rode pnpm gen:schema com o arquivo novo.`,
    name: 'XSD publicado',
    ok: same,
  };
}

async function checkXsdPage(): Promise<Check> {
  const { bytes, res } = await fetchBytes(EXTRACAO_URL);
  const html = new TextDecoder('utf-8').decode(bytes);
  if (!res.ok) return { detail: `HTTP ${res.status}`, name: 'Página do Extrator', ok: false };
  const hasMarker = html.includes(XSD_DATE_MARKER);
  const hasLink = html.includes(XSD_URL.replace('https://memoria.cnpq.br', ''));
  const said = /atualizado em [^)<]*/.exec(html)?.[0];
  return {
    detail:
      hasMarker && hasLink
        ? `ainda diz "${XSD_DATE_MARKER}" e linka o mesmo arquivo`
        : `${hasMarker ? 'data igual' : `a data mudou: "${said ?? 'texto não encontrado'}"`}; ${hasLink ? 'link igual' : 'o link do XSD mudou'}`,
    name: 'Página do Extrator',
    ok: hasMarker && hasLink,
  };
}

async function checkFoto(): Promise<Check> {
  const { bytes, res } = await fetchBytes(FOTO_URL);
  const type = res.headers.get('content-type') ?? '';
  const ok = res.ok && type.startsWith('image/');
  return {
    detail: `HTTP ${res.status}, ${type || 'sem content-type'}, ${bytes.length} bytes`,
    name: 'Foto do perfil',
    ok,
  };
}

async function checkPage(name: string, url: string, marker: string): Promise<Check> {
  const { bytes, res } = await fetchBytes(url);
  const html = new TextDecoder('latin1').decode(bytes);
  const ok = res.ok && html.includes(marker);
  return {
    detail: `HTTP ${res.status}${ok ? '' : `, sem "${marker}" na resposta`}`,
    name,
    ok,
  };
}

function report(checks: Check[]): string {
  const failed = checks.filter((c) => !c.ok);
  const lines = [
    `## Vigia do Lattes: ${failed.length ? `${failed.length} de ${checks.length} conferências falharam` : 'tudo como o esperado'}`,
    '',
    `Conferido em ${new Date().toISOString()}.`,
    '',
    '| Conferência | Resultado | Detalhe |',
    '| --- | --- | --- |',
    ...checks.map((c) => `| ${c.name} | ${c.ok ? 'ok' : '**mudou**'} | ${c.detail} |`),
    '',
    'O que fica atrás do login (menu, formulários, campos) só a extensão confere: "Verificar o Lattes" no painel da ponte.',
  ];
  return lines.join('\n');
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : undefined;
}

const saveTo = arg('--guardar');
const results = await Promise.all([
  checkXsd(saveTo),
  checkXsdPage(),
  checkFoto(),
  checkPage('Entrada do Lattes', LATTES_URL, 'Lattes'),
  checkPage('Menu do editor (sem sessão)', MENU_URL, 'lattes.cnpq.br'),
]);
const md = report(results);
const out = arg('--saida');
if (out) writeFileSync(out, `${md}\n`);
console.log(md);
process.exitCode = results.every((c) => c.ok) ? 0 : 1;
