// Opções de f_tipo_licenca no censo de 15/10/2026. MATERNIDADE está no XSD;
// PATERNIDADE e ADOCAO vieram na exportação de 29/10/2026 (schema/patch.json,
// docs/lattes_internals.md, seção 29).

export const licenseChoices = [
  { label: 'Maternidade', value: 'MATERNIDADE' },
  { label: 'Paternidade', value: 'PATERNIDADE' },
  { label: 'Adoção', value: 'ADOCAO' },
];

export const LICENSE_TYPES: Record<string, string> = {
  ADOCAO: 'A',
  MATERNIDADE: 'M',
  PATERNIDADE: 'P',
};

/** O tipo é obrigatório no Lattes; vazio ou desconhecido não vira pedido. */
export const licenseToForm = (value: string): string | undefined =>
  Object.hasOwn(LICENSE_TYPES, value) ? LICENSE_TYPES[value] : undefined;
