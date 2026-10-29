// As respostas JSON das duas consultas antes do envio ao CNPq (publish.ts):
// a de raça ou cor e a de e-mail, como foram observadas em 14/10/2026.

/** {"status": true} da consulta de raça ou cor; undefined se a resposta não é esse JSON. */
export function readRaceReply(text: string): boolean | undefined {
  try {
    const data = JSON.parse(text) as { status?: unknown };
    return typeof data.status === 'boolean' ? data.status : undefined;
  } catch {
    return undefined;
  }
}

/** {"existe": false, "mensagem": …} da consulta de e-mail. */
export function readEmailReply(text: string): { exists: boolean; message?: string } | undefined {
  try {
    const data = JSON.parse(text) as { existe?: unknown; mensagem?: unknown };
    if (typeof data.existe !== 'boolean') return undefined;
    return {
      exists: data.existe,
      message: typeof data.mensagem === 'string' ? data.mensagem : undefined,
    };
  } catch {
    return undefined;
  }
}
