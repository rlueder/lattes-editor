// Opções de f_tipo_licenca no censo de 15/10/2026. MATERNIDADE está no XSD;
// PATERNIDADE e ADOCAO mantêm os valores inferidos que o conector já usava.

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
