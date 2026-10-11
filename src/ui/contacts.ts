// Contatos do bloco ENDERECO, que a exportação traz serializados num atributo
// só (campos acrescentados depois do XSD publicado):
//
//   ELETRONICO:  "I: nome@instituicao.br"  (I = endereço institucional,
//                R = residencial, como os campos _i/_r do formulário do Lattes)
//   REDE-SOCIAL: "ID Rede Social: 7442497, Nome Rede Social: Linkedin,
//                 Endereço: https://..."
//
// O separador entre várias entradas não foi visto numa exportação real; o
// leitor procura cada padrão no texto inteiro e, se nada casar, a tela mostra
// o valor como veio.

import { repairMojibake } from '../model/mojibake.ts';

export interface EmailContact {
  /** Endereço a que o e-mail pertence, quando o código é conhecido. */
  address?: 'Institucional' | 'Residencial';
  email: string;
}

export interface SocialContact {
  name: string;
  url: string;
}

const ADDRESS: Record<string, EmailContact['address']> = { I: 'Institucional', R: 'Residencial' };

export function parseEmails(value: string): EmailContact[] {
  return [...value.matchAll(/(?:\b([IR]):\s*)?([^\s,;:]+@[^\s,;]+)/g)].map((m) => ({
    address: m[1] ? ADDRESS[m[1]] : undefined,
    email: m[2]!,
  }));
}

export function parseSocial(value: string): SocialContact[] {
  const text = repairMojibake(value) ?? value;
  return [
    ...text.matchAll(/Nome Rede Social:\s*([^,]+?)\s*,\s*Endere\S*o:\s*(\S+?)(?=[\s,;]|$)/g),
  ].map((m) => ({ name: m[1]!, url: m[2]! }));
}
