// Editar só o endereço de um contato existente, sem reconstruir o atributo
// serializado nem presumir o separador entre registros (contacts.ts).

import { socialName } from './contacts.ts';

export interface ContactField {
  end: number;
  kind: 'email' | 'url';
  label: string;
  start: number;
  value: string;
}

/** Formato inteiro reconhecido, sem registros desconhecidos ou e-mails sem tipo. */
export function editableContacts(attr: string, raw: string): ContactField[] | undefined {
  const email = attr === 'ELETRONICO';
  if (!email && attr !== 'REDE-SOCIAL') return undefined;
  const pattern = email
    ? /\b([IR]):\s*([^\s,;:]+@[^\s,;]+)/g
    : /ID Rede Social:\s*\d+,\s*Nome Rede Social:\s*([^,]+?)\s*,\s*Endere\S*o:\s*(\S+?)(?=ID Rede Social:|[\s,;]|$)/g;
  const matches = [...raw.matchAll(pattern)];
  if (!matches.length || raw.replace(pattern, '').replace(/[\s,;]/g, '') !== '') return undefined;
  if (email && new Set(matches.map((m) => m[1])).size !== matches.length) return undefined;
  if (!email && new Set(matches.map((m) => socialName(m[1]!))).size !== matches.length)
    return undefined;
  return matches.map((m) => {
    const value = m[2]!;
    const start = m.index + m[0].lastIndexOf(value);
    return {
      end: start + value.length,
      kind: email ? 'email' : 'url',
      label: email
        ? m[1] === 'I'
          ? 'E-mail para contato'
          : 'E-mail alternativo'
        : socialName(m[1]!),
      start,
      value,
    };
  });
}

/** O novo valor precisa caber num registro, sem acrescentar outro por um delimitador. */
export function contactValueProblem(kind: ContactField['kind'], value: string): string | undefined {
  if (kind === 'email') {
    return /^[^\s,;:@]+@[^\s,;:@]+\.[^\s,;:@]+$/.test(value)
      ? undefined
      : 'Informe um e-mail válido.';
  }
  if (/[\s,;]/.test(value))
    return 'Informe um endereço https:// ou http:// sem espaços, vírgula ou ponto e vírgula.';
  try {
    const url = new URL(value);
    if ((url.protocol === 'https:' || url.protocol === 'http:') && url.hostname) return undefined;
  } catch {
    // O endereço incompleto fica no campo, sem alterar o XML.
  }
  return 'Informe um endereço que comece com https:// ou http://.';
}

/** Substitui só o trecho reconhecido; o restante conserva cada caractere. */
export function replaceContactValue(
  raw: string,
  attr: string,
  index: number,
  value: string,
): string | undefined {
  const field = editableContacts(attr, raw)?.[index];
  const next = value.trim();
  if (!field || contactValueProblem(field.kind, next)) return undefined;
  return raw.slice(0, field.start) + next + raw.slice(field.end);
}
