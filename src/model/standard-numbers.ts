// ISSN e ISBN: dígito verificador, limpeza ao sair do campo e o aviso de
// formato, no mesmo tom do DOI e do endereço (src/ui/link-fields.ts): aviso
// sob o campo, sem impedir digitar nem salvar.
//
// Formato guardado: nenhuma exportação real no repositório traz ISSN ou ISBN
// preenchido. O censo LAT-55 (docs/lattes-formularios/) dá o tamanho dos
// campos do Lattes: f_issn com até 10 caracteres (cabe 0317-8471 e 03178471)
// e f_isbn com até 13. Um ISBN-13 com hífens tem 17 caracteres e não cabe no
// campo do Lattes: o ISBN se guarda só com os dígitos (e o X do ISBN-10). O
// ISSN fica como foi digitado, com ou sem o hífen, sem espaços e com o X
// maiúsculo; a prévia mostra NNNN-NNNN. Nada converte ISBN-10 em ISBN-13.

/** Atributo de ISSN. */
export function isIssnAttr(attr: string): boolean {
  return attr === 'ISSN';
}

/** Atributo de ISBN. */
export function isIsbnAttr(attr: string): boolean {
  return attr === 'ISBN';
}

/** ISSN-ISBN (tradução, prefácio, outra produção): vale um ou outro. */
export function isIssnOrIsbnAttr(attr: string): boolean {
  return attr === 'ISSN-ISBN';
}

/** Só os caracteres que contam, sem hífens nem espaços, com o X maiúsculo. */
function compact(value: string): string {
  return value.replace(/[-\s]/g, '').toUpperCase();
}

/** Dígito verificador do ISSN (ISO 3297): pesos 8 a 2, módulo 11; 10 vira X. */
export function issnCheckDigit(first7: string): string {
  const sum = [...first7].reduce((acc, d, i) => acc + Number(d) * (8 - i), 0);
  const check = (11 - (sum % 11)) % 11;
  return check === 10 ? 'X' : String(check);
}

/** ISSN com dígito verificador certo, com ou sem o hífen. */
export function validIssn(value: string): boolean {
  const s = compact(value);
  return /^\d{7}[\dX]$/.test(s) && s[7] === issnCheckDigit(s.slice(0, 7));
}

/** ISBN-10: pesos 10 a 1, a soma divisível por 11; o último pode ser X (10). */
function validIsbn10(s: string): boolean {
  if (!/^\d{9}[\dX]$/.test(s)) return false;
  const sum = [...s].reduce((acc, c, i) => acc + (c === 'X' ? 10 : Number(c)) * (10 - i), 0);
  return sum % 11 === 0;
}

/** ISBN-13: começa com 978 ou 979; pesos 1 e 3 alternados, a soma divisível por 10. */
function validIsbn13(s: string): boolean {
  if (!/^97[89]\d{10}$/.test(s)) return false;
  const sum = [...s].reduce((acc, c, i) => acc + Number(c) * (i % 2 === 0 ? 1 : 3), 0);
  return sum % 10 === 0;
}

/** ISBN-10 ou ISBN-13 com dígito verificador certo, com ou sem hífens e espaços. */
export function validIsbn(value: string): boolean {
  const s = compact(value);
  return s.length === 10 ? validIsbn10(s) : validIsbn13(s);
}

/** Aviso do ISSN, ou undefined se está bom ou vazio. */
export function issnError(value: string): string | undefined {
  const s = compact(value);
  if (!s) return undefined;
  if (!/^\d{7}[\dX]$/.test(s)) {
    return 'ISSN inválido: são 8 caracteres (NNNN-NNNN), o último um dígito ou X';
  }
  return validIssn(s) ? undefined : 'ISSN inválido: o dígito verificador não confere';
}

/** Aviso do ISBN, ou undefined se está bom ou vazio. */
export function isbnError(value: string): string | undefined {
  const s = compact(value);
  if (!s) return undefined;
  if (s.length === 10) {
    if (!/^\d{9}[\dX]$/.test(s)) {
      return 'ISBN inválido: o ISBN-10 tem 9 dígitos e um último dígito ou X';
    }
    return validIsbn10(s) ? undefined : 'ISBN inválido: o dígito verificador não confere';
  }
  if (s.length === 13 && /^\d{13}$/.test(s)) {
    if (!/^97[89]/.test(s)) return 'ISBN inválido: o ISBN-13 começa com 978 ou 979';
    return validIsbn13(s) ? undefined : 'ISBN inválido: o dígito verificador não confere';
  }
  return 'ISBN inválido: são 10 ou 13 dígitos';
}

/** O ISSN-ISBN de um item: com 8 caracteres, ISSN; senão, ISBN. */
export function issnOrIsbnError(value: string): string | undefined {
  return compact(value).length === 8 ? issnError(value) : isbnError(value);
}

/** ISSN como se guarda: sem espaços, X maiúsculo, o hífen como veio. */
export function cleanIssn(value: string): string {
  return value.replace(/\s+/g, '').toUpperCase();
}

/** ISBN como se guarda: só os dígitos e o X. */
export function cleanIsbn(value: string): string {
  return compact(value);
}

/** ISSN para mostrar: NNNN-NNNN quando tem os 8 caracteres; senão, como veio. */
export function formatIssn(value: string): string {
  const s = compact(value);
  return /^\d{7}[\dX]$/.test(s) ? `${s.slice(0, 4)}-${s.slice(4)}` : value;
}
