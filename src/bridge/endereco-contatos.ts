// As grades de contato do formulário de endereço (prc_endereco, GN_ENDERECO,
// lido em 18/10/2026; docs/lattes_internals.md, seção 18): as redes sociais
// (vetor `provider`, linhas {id, redeSocial, endereco, privacidade,
// visibilidade}) e as outras formas de contato (vetor `providerContatos`,
// linhas {id, contato, endereco, privacidade, visibilidade}). O check() da
// página serializa as duas em f_dados_grid e f_dados_grid_contatos com o
// array2xml("item", "root", …) da própria página, por cima do json2xml que
// ela traz; a página carrega os dois ocultos vazios. Por isso todo envio do
// formulário de endereço leva as duas grades como a página as mandaria, e
// não os ocultos vazios, que poderiam apagá-las.
//
// Os e-mails não são grade: f_email_i (e-mail para contato) e f_email_r
// (e-mail alternativo), campos de texto.

import type { Change } from '../model/changes.ts';
import { editableContacts } from '../model/contact-edit.ts';
import { parseEmails, parseSocial } from '../model/contacts.ts';
import type { ResultStatus } from './apply.ts';
import type { FieldValues } from './plan.ts';
import type { GridRow } from './production/grids.ts';
import { readProvider } from './production/grids.ts';

/** Uma rede social como o editor a vê: o nome da rede e o endereço. */
export interface SocialRow {
  name: string;
  url: string;
}

/** O Lattes aceita até cinco redes sociais (o "no máximo até 5 registros" da página). */
export const MAX_SOCIAL = 5;

/** Outra forma de contato pelo conector (op.contacts): só a uma extensão com 'outra-forma-contato'. */
export const EDIT_OTHER_CONTACTS_ENABLED = true;

function makeSafe(str: string): string {
  // Como a página: o < antes do &, e as quebras de linha à moda Unix.
  return str.replace(/</g, '&lt;').replace(/&/g, '&amp;').replace(/\r\n/g, '\n');
}

/** O json2xml.convert da página, para um vetor de linhas planas. */
function json2xml(rows: readonly GridRow[]): string {
  let xml = '';
  rows.forEach((row, i) => {
    const keys = Object.keys(row).filter((k) => !k.startsWith('@'));
    xml += `<${i}`;
    if (keys.length === 0) {
      xml += '/>';
      return;
    }
    xml += '>\n';
    for (const k of keys) xml += `\t<${k}>${makeSafe(String(row[k]))}</${k}>\n`;
    xml += `</${i}>\n`;
  });
  return xml;
}

/** O array2xml("item", "root", rows) da página, com as mesmas substituições. */
export function array2xml(rows: readonly GridRow[]): string {
  const xml = json2xml(rows)
    .replace(/<\d*>/g, '<item>')
    .replace(/<\/\d*>/g, '</item >')
    .replace(/<\d*\/>/, '');
  return `<root>${xml}</root >`;
}

/** As duas grades da página de endereço, como ela as carrega; undefined sem uma delas. */
export function readContactGrids(
  html: string,
): { contacts: GridRow[]; social: GridRow[] } | undefined {
  const social = readProvider(html, 'provider');
  const contacts = readProvider(html, 'providerContatos');
  return social && contacts ? { contacts, social } : undefined;
}

/** As redes sociais de uma grade (sem a linha em branco do fim). */
export const socialOf = (rows: readonly GridRow[]): SocialRow[] =>
  rows
    .filter((r) => r.id !== undefined && r.id !== '')
    .map((r) => ({ name: String(r.redeSocial ?? ''), url: String(r.endereco ?? '') }));

const key = (r: SocialRow) => `${r.name.trim().toLowerCase()}|${r.url.trim()}`;

/** A lista de redes é a mesma, na ordem, sem diferença de caixa no nome? */
export const sameSocial = (a: readonly SocialRow[], b: readonly SocialRow[]) =>
  a.length === b.length && a.every((r, i) => key(r) === key(b[i]!));

/**
 * A grade de redes para a lista nova, na ordem dela. Uma rede que já estava
 * fica com a linha dela (o id do tipo e a privacidade); uma nova entra com o
 * id do tipo de rede da lista da página (redesSociais), pública, como o
 * "Inserir nova" da página a monta. Sem o tipo na lista, o nome da rede.
 */
export function socialGrid(
  current: readonly GridRow[],
  types: readonly GridRow[],
  after: readonly SocialRow[],
): { ambiguous: string } | { rows: GridRow[] } | { unknown: string } {
  const rows: GridRow[] = [];
  for (const r of after) {
    const old = current.find(
      (c) => c.id !== undefined && c.id !== '' && key(socialOf([c])[0]!) === key(r),
    );
    if (old) {
      rows.push(old);
      continue;
    }
    // Ao editar só o endereço de uma rede já cadastrada, a privacidade e o id
    // continuam os da linha. Não transforma uma rede privada em pública.
    const sameNetwork = (name: unknown) =>
      String(name ?? '')
        .trim()
        .toLowerCase() === r.name.trim().toLowerCase();
    // As linhas desta rede que a mudança trocou (as que não voltam iguais em
    // after) e as entradas novas dela: uma de cada é a troca do endereço;
    // nenhuma trocada é uma inclusão (outro perfil na mesma rede); o resto
    // não dá para saber qual linha virou qual.
    const kept = (c: GridRow) => after.some((a) => key(a) === key(socialOf([c])[0]!));
    const changed = current.filter(
      (c) => c.id !== undefined && c.id !== '' && sameNetwork(c.redeSocial) && !kept(c),
    );
    const fresh = after.filter(
      (a) =>
        sameNetwork(a.name) &&
        !current.some(
          (c) => c.id !== undefined && c.id !== '' && key(socialOf([c])[0]!) === key(a),
        ),
    );
    if (changed.length === 1 && fresh.length === 1) {
      rows.push({ ...changed[0], endereco: r.url });
      continue;
    }
    if (changed.length > 0) return { ambiguous: r.name };
    const type = types.find(
      (t) =>
        String(t.redeSocial ?? '')
          .trim()
          .toLowerCase() === r.name.trim().toLowerCase(),
    );
    if (!type || type.id === undefined) return { unknown: r.name };
    // As chaves na ordem em que o "Inserir nova" da página monta a linha.
    rows.push(
      Object.fromEntries([
        ['id', String(type.id)],
        ['redeSocial', String(type.redeSocial)],
        ['endereco', r.url],
        ['privacidade', '1'],
        ['visibilidade', 'Público'],
      ]),
    );
  }
  return { rows: [...rows, {}] };
}

/** A mesma lista de redes, em qualquer ordem (a página põe a nova no topo). */
export const sameSocialSet = (a: readonly SocialRow[], b: readonly SocialRow[]) =>
  a.length === b.length && [...a].map(key).sort().join('\n') === [...b].map(key).sort().join('\n');

/** A releitura também confere os IDs e a privacidade, sem depender da ordem das linhas. */
export function sameSocialPrivacy(a: readonly GridRow[], b: readonly GridRow[]): boolean {
  const signatures = (rows: readonly GridRow[]) =>
    rows
      .filter((row) => row.id !== undefined && row.id !== '')
      .map((row) =>
        JSON.stringify([
          String(row.redeSocial ?? '')
            .trim()
            .toLowerCase(),
          String(row.endereco ?? '').trim(),
          String(row.id),
          String(row.privacidade ?? ''),
        ]),
      )
      .sort();
  return JSON.stringify(signatures(a)) === JSON.stringify(signatures(b));
}

/** Os tipos de rede social que a página oferece (vetor redesSociais). */
export const socialTypes = (html: string): GridRow[] =>
  (readProvider(html, 'redesSociais') ?? []).filter((t) => t.id !== undefined);

/** As outras formas de contato de uma grade: o tipo e o contato (sem a linha em branco do fim). */
export const contactRowsOf = (rows: readonly GridRow[]): SocialRow[] =>
  rows
    .filter((r) => r.id !== undefined && r.id !== '')
    .map((r) => ({ name: String(r.contato ?? ''), url: String(r.endereco ?? '') }));

/**
 * A grade de outras formas de contato com os contatos novos: cada linha de
 * antes fica com o id, o tipo e a privacidade dela, e troca só o endereço
 * (lido em 26/10/2026; exportação de 27/10/2026, seção 25).
 */
function contactGrid(
  current: readonly GridRow[],
  change: { after: SocialRow[]; before: SocialRow[] },
): GridRow[] {
  const used = new Set<number>();
  return current.map((r) => {
    if (r.id === undefined || r.id === '') return r;
    const row = contactRowsOf([r])[0]!;
    const i = change.before.findIndex((b, j) => !used.has(j) && key(b) === key(row));
    if (i < 0) return r;
    used.add(i);
    return { ...r, endereco: change.after[i]!.url };
  });
}

/**
 * As duas grades de contato do endereço para o envio: as redes como a
 * mudança as quer (ou como estão) e as outras formas de contato com os
 * contatos novos (ou como estão).
 */
export function enderecoGrids(
  op: {
    contacts?: { after: SocialRow[]; before: SocialRow[] };
    social?: { after: SocialRow[]; before: SocialRow[] };
  },
  html: string,
):
  | { detail: string; status: ResultStatus }
  | {
      read: NonNullable<ReturnType<typeof readContactGrids>>;
      set: FieldValues;
      socialRows: GridRow[];
      wanted: SocialRow[];
    } {
  const read = readContactGrids(html);
  if (!read) {
    return {
      detail: 'A página de endereço do Lattes não trouxe as grades de contato; nada foi enviado',
      status: 'erro',
    };
  }
  const current = socialOf(read.social);
  if (op.social && !sameSocialSet(current, op.social.before)) {
    return {
      detail: 'O Lattes não está como o editor espera: Redes sociais',
      status: 'divergente',
    };
  }
  const social = op.social
    ? socialGrid(read.social, socialTypes(html), op.social.after)
    : { rows: read.social };
  if ('ambiguous' in social) {
    return {
      detail: `Há mais de um registro da rede ${social.ambiguous}; edite no Lattes para preservar a privacidade de cada um.`,
      status: 'erro',
    };
  }
  if ('unknown' in social) {
    return { detail: `Rede social que o Lattes não tem: ${social.unknown}`, status: 'erro' };
  }
  if (op.contacts && !sameSocialSet(contactRowsOf(read.contacts), op.contacts.before)) {
    return {
      detail: 'O Lattes não está como o editor espera: Outra forma de contato',
      status: 'divergente',
    };
  }
  const contacts = op.contacts ? contactGrid(read.contacts, op.contacts) : read.contacts;
  return {
    // A releitura confere a grade de contatos com a que foi enviada.
    read: { ...read, contacts },
    set: { f_dados_grid: array2xml(social.rows), f_dados_grid_contatos: array2xml(contacts) },
    socialRows: social.rows,
    wanted: op.social?.after ?? current,
  };
}

type ContactChange = { after: SocialRow[]; before: SocialRow[] };

/**
 * Os contatos do ENDERECO (contacts.ts no editor): e-mails em ELETRONICO
 * ("I: …" para contato, "R: …" alternativo, o R inferido pelo sufixo do
 * campo), redes em REDE-SOCIAL e outras formas de contato em
 * OUTRA-FORMA-DE-CONTATO, no formato das redes (exportação de 27/10/2026).
 */
export function planContacts(change: Change): {
  expect: FieldValues;
  reason?: string;
  set: FieldValues;
  contacts?: ContactChange;
  social?: ContactChange;
} {
  const set: FieldValues = {};
  const expect: FieldValues = {};
  let social: ContactChange | undefined;
  let contacts: ContactChange | undefined;
  for (const f of change.fields) {
    if (f.attr === 'OUTRA-FORMA-DE-CONTATO') {
      const of = (v: string) =>
        v.trim() ? editableContacts(f.attr, v)?.map((c) => ({ name: c.label, url: c.value })) : [];
      const [was, now] = [of(f.before), of(f.after)];
      if (!was || !now) {
        return {
          expect,
          reason:
            'Outra forma de contato: o texto não está no formato do Lattes ou tem registros ambíguos',
          set,
        };
      }
      // Só o endereço de um contato que já existe: incluir, tirar ou trocar o
      // tipo pede a privacidade e o tipo da página, que o XML não traz.
      if (was.length !== now.length || was.some((c, i) => c.name !== now[i]!.name)) {
        return {
          expect,
          reason:
            'Outra forma de contato: incluir, tirar ou trocar o tipo vai no Lattes; aqui só muda o contato',
          set,
        };
      }
      contacts = { after: now, before: was };
    }
    if (f.attr === 'ELETRONICO') {
      if ([f.before, f.after].some((value) => value.trim() && !editableContacts(f.attr, value))) {
        return {
          expect,
          reason:
            'E-mails: cada um precisa dizer se é para contato (I:) ou alternativo (R:), sem trechos desconhecidos',
          set,
        };
      }
      const of = (v: string) => {
        const all = parseEmails(v);
        const pick = (a: string) => all.find((e) => e.address === a)?.email ?? '';
        return { i: pick('E-mail para contato'), n: all.length, r: pick('E-mail alternativo') };
      };
      const [was, now] = [of(f.before), of(f.after)];
      if (now.n !== (now.i ? 1 : 0) + (now.r ? 1 : 0)) {
        return {
          expect,
          reason: 'E-mails: cada um precisa dizer se é para contato (I:) ou alternativo (R:)',
          set,
        };
      }
      Object.assign(set, { f_email_i: now.i, f_email_r: now.r });
      Object.assign(expect, { f_email_i: was.i, f_email_r: was.r });
    }
    if (f.attr === 'REDE-SOCIAL') {
      if ([f.before, f.after].some((value) => value.trim() && !editableContacts(f.attr, value))) {
        return {
          expect,
          reason: 'Redes sociais: o texto não está no formato do Lattes ou tem registros ambíguos',
          set,
        };
      }
      const before = parseSocial(f.before).map((r) => ({ name: r.name, url: r.url }));
      const after = parseSocial(f.after).map((r) => ({ name: r.name, url: r.url }));
      if (f.after.trim() && after.length === 0) {
        return { expect, reason: 'Redes sociais: o texto não está no formato do Lattes', set };
      }
      if (after.length > MAX_SOCIAL) {
        return { expect, reason: `O Lattes aceita até ${MAX_SOCIAL} redes sociais`, set };
      }
      social = { after, before };
    }
  }
  return { expect, set, ...(social ? { social } : {}), ...(contacts ? { contacts } : {}) };
}
