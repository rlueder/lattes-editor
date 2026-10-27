// Contatos do bloco ENDERECO, que a exportação traz serializados num atributo
// só (campos acrescentados depois do XSD publicado):
//
//   ELETRONICO:  "I: nome@instituicao.br". No formulário de endereço do
//                Lattes (censo LAT-55), f_email_i é "e-mail para contato" e
//                f_email_r é "e-mail alternativo"; que I e R sejam esses dois
//                campos é inferido pelo sufixo (_i, _r), não observado.
//   REDE-SOCIAL: "ID Rede Social: 7442497, Nome Rede Social: Linkedin,
//                 Endereço: https://..."
//
// Numa exportação real (27/10/2026), as entradas de REDE-SOCIAL vêm coladas,
// sem separador: o "ID Rede Social" da seguinte começa logo depois do
// endereço ("…/in/nome/ID Rede Social: 2, …"). O endereço termina no espaço,
// na vírgula, no ponto e vírgula ou no começo da entrada seguinte. O leitor
// procura cada padrão no texto inteiro e, se nada casar, a tela mostra o
// valor como veio.

import { repairMojibake } from './mojibake.ts';

export interface EmailContact {
  /** O campo do Lattes a que o e-mail pertence, quando o código é conhecido. */
  address?: 'E-mail para contato' | 'E-mail alternativo';
  email: string;
}

export interface SocialContact {
  name: string;
  url: string;
}

const ADDRESS: Record<string, EmailContact['address']> = {
  I: 'E-mail para contato',
  R: 'E-mail alternativo',
};

export function parseEmails(value: string): EmailContact[] {
  return [...value.matchAll(/(?:\b([IR]):\s*)?([^\s,;:]+@[^\s,;]+)/g)].map((m) => ({
    address: m[1] ? ADDRESS[m[1]] : undefined,
    email: m[2]!,
  }));
}

export function parseSocial(value: string): SocialContact[] {
  const text = repairMojibake(value) ?? value;
  return [
    ...text.matchAll(
      /Nome Rede Social:\s*([^,]+?)\s*,\s*Endere\S*o:\s*(\S+?)(?=ID Rede Social:|[\s,;]|$)/g,
    ),
  ].map((m) => ({ name: socialName(m[1]!), url: m[2]! }));
}

/** Grafia das redes mais comuns; as outras ficam como vieram, com maiúscula. */
const SOCIAL_NAMES: Record<string, string> = {
  facebook: 'Facebook',
  github: 'GitHub',
  instagram: 'Instagram',
  linkedin: 'LinkedIn',
  researchgate: 'ResearchGate',
  twitter: 'Twitter',
  x: 'X',
  youtube: 'YouTube',
};

export function socialName(name: string): string {
  const key = name.trim().toLocaleLowerCase('pt-BR').replace(/\s+/g, '');
  const known = SOCIAL_NAMES[key];
  if (known) return known;
  const t = name.trim();
  return t.charAt(0).toLocaleUpperCase('pt-BR') + t.slice(1);
}

/**
 * Telefone como se lê: "(51) 99999-9999", "(51) 3308-1234" ou, sem DDD, só o
 * número. Fora de 8 ou 9 dígitos, o número fica como veio.
 */
export function formatPhone(ddd: string, number: string): string {
  const d = ddd.replace(/\D/g, '');
  const n = number.replace(/\D/g, '');
  const body =
    n.length === 8 || n.length === 9 ? `${n.slice(0, -4)}-${n.slice(-4)}` : number.trim();
  return d ? `(${d}) ${body}` : body;
}
