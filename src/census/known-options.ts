// O valor do XSD de uma opção do Lattes cujo rótulo não diz qual é, quando ele
// foi visto numa exportação real. A passada de edição de 18/10/2026 criou um
// item de teste por opção, e cada variante escolheu a opção de mesmo índice em
// todos os campos: o valor de um atributo aparece no mapa de outro campo, e o
// índice da variante liga os dois (scripts de triagem da passada). Só entra o
// que essa ligação mostrou sem contradição.

/** Por ELEMENTO@ATRIBUTO, ou só pelo ATRIBUTO quando a lista de códigos é a mesma em toda produção. */
export const KNOWN_OPTION_VALUES: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  'DADOS-BASICOS-DO-LIVRO@TIPO': { '133': 'LIVRO_ORGANIZADO_OU_EDICAO' },
  'DADOS-BASICOS-DO-TEXTO@NATUREZA': { '142': 'REVISTA_MAGAZINE' },
  // Visto em artes cênicas e visuais (V → VARIOS nas duas); o Lattes usa os
  // mesmos códigos (I, M, D, F, H, O, V) em todo meio de divulgação.
  'MEIO-DE-DIVULGACAO': { V: 'VARIOS' },
};

/** O valor conhecido de uma opção, pelo elemento e atributo ou só pelo atributo. */
export function knownOptionValue(
  element: string,
  attribute: string,
  code: string,
): string | undefined {
  return (
    KNOWN_OPTION_VALUES[`${element}@${attribute}`]?.[code] ?? KNOWN_OPTION_VALUES[attribute]?.[code]
  );
}
