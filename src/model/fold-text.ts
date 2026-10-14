// Comparação de texto sem acento nem maiúscula, comum ao modelo, ao esquema e
// à interface (o filtro das listas e a conferência dos campos tipados).

/** Sem acento, em minúsculas e sem espaço nas pontas: "São Tomé" casa com "sao to". */
export function foldText(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}
