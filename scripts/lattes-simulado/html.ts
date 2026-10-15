// Pedaços de HTML com que o Lattes simulado monta as páginas: campos de
// formulário, a moldura da página e os scripts que as telas reais têm
// (enviar(), del(), as camadas modais do menu). Só o necessário para o
// conector ler o que o Lattes de verdade mostra e para uma pessoa clicar no
// navegador.

import listas from '../../docs/lattes-listas/captura-2026-10-13.json' with { type: 'json' };

/** Escapa texto para HTML (conteúdo e atributos). */
export function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Escapa texto para uma string JavaScript entre apóstrofos, dentro de HTML. */
export function jsString(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\n/g, '\\n')
    .replace(/</g, '\\x3c');
}

export interface FieldOptions {
  disabled?: boolean;
  maxLength?: number;
}

const extra = (o: FieldOptions = {}) =>
  `${o.maxLength ? ` maxlength="${o.maxLength}"` : ''}${o.disabled ? ' disabled' : ''}`;

export function hidden(name: string, value: string): string {
  return `<input type="hidden" name="${name}" value="${esc(value)}">`;
}

export function text(name: string, value: string, o?: FieldOptions): string {
  return `<input type="text" name="${name}" value="${esc(value)}"${extra(o)}>`;
}

export function textarea(name: string, value: string, o?: FieldOptions): string {
  return `<textarea name="${name}"${extra(o)}>${esc(value)}</textarea>`;
}

export function checkbox(name: string, value: string, checked: boolean): string {
  return `<input type="checkbox" name="${name}" value="${esc(value)}"${checked ? ' checked' : ''}>`;
}

/** Rádios de um nome, um por opção [valor, rótulo]. */
export function radios(name: string, options: [string, string][], current: string): string {
  return options
    .map(
      ([value, label]) =>
        `<label><input type="radio" name="${name}" value="${esc(value)}"${value === current ? ' checked' : ''}> ${esc(label)}</label>`,
    )
    .join('\n');
}

/** Lista com opções [valor, rótulo]; a do valor atual vem marcada. */
export function select(
  name: string,
  options: [string, string][],
  current: string,
  o?: FieldOptions,
): string {
  const body = options
    .map(
      ([value, label]) =>
        `<option value="${esc(value)}"${value === current ? ' selected' : ''}>${esc(label)}</option>`,
    )
    .join('');
  return `<select name="${name}"${extra(o)}>${body}</select>`;
}

/** Uma lista capturada do Lattes em 13/10/2026 (docs/lattes-listas/), como pares [código, rótulo]. */
export function capturedList(id: keyof typeof listas.lists): [string, string][] {
  return listas.lists[id].map((entry) => {
    const i = entry.indexOf('|');
    return [entry.slice(0, i), entry.slice(i + 1)] as [string, string];
  });
}

/** Países (código de três letras) e idiomas (duas letras), como nos formulários. */
export const COUNTRIES = capturedList('L0');
export const LANGUAGES = capturedList('L1');
/** Público e privado, a lista f_tipo_privacidade. */
export const PRIVACY = capturedList('L4');

/** O código do país pelo nome que o XML traz; vazio se não há. */
export function countryCode(name: string | undefined): string {
  if (!name) return '';
  const folded = name
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
  const hit = COUNTRIES.find(
    ([, label]) =>
      label
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .toLowerCase() === folded,
  );
  return hit?.[0] ?? '';
}

export function countryName(code: string): string {
  return COUNTRIES.find(([c]) => c === code)?.[1] ?? '';
}

/**
 * Os scripts que os formulários de edição têm: enviar() posta o formulário
 * inteiro; del() confirma, troca f_ctr para E e envia (seção 15). O texto do
 * confirm muda por tela.
 */
export function formScripts(form: string, confirmText?: string): string {
  const del = confirmText
    ? `function del(){ if (confirm('${jsString(confirmText)}')) { dc.f_ctr.value = 'E'; enviar(); } }`
    : '';
  return `<script>var dc = document.forms['${form}']; function enviar(){ dc.submit(); } ${del}</script>`;
}

/** Botões Salvar e, na alteração, Excluir, como links com onclick. */
export function formButtons(canDelete: boolean): string {
  const excluir = canDelete
    ? ' <a href="#" class="botao excluir" onclick="del(); return false;">Excluir</a>'
    : '';
  return `<p><a href="#" class="botao salvar" onclick="enviar(); return false;">Salvar</a>${excluir}</p>`;
}

/** Uma página do Lattes simulado, com a marca de que não é o Lattes. */
export function page(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="ISO-8859-1"><title>${esc(title)}</title>
<style>body{font:14px sans-serif;margin:16px}label{margin-right:12px}input[type=text],textarea,select{margin:2px 0}.simulado{background:#fde68a;padding:4px 8px}</style>
</head><body><p class="simulado">Lattes simulado: nada aqui vai ao CNPq.</p>
<h2>${esc(title)}</h2>
${body}
</body></html>`;
}

/**
 * A resposta que o Lattes dá a um POST de formulário gravado: um trecho de
 * JavaScript que manda o iframe pai voltar para a lista e abre o aviso de
 * pendências (seção 6, observado no vínculo em 11/10/2026).
 */
export function savedScript(back: string): string {
  return `<script>self.parent.modalCV2.setarUrl('${jsString(back)}', true); self.parent.modalCV1.setarUrl('pkg_aviso_pendencia.inicio', true);</script>`;
}

/**
 * A resposta a um POST de evento gravado ou excluído, observada em
 * 14/10/2026: checkPublicacao() e a caixa de mensagem do menu.
 */
export function eventSavedScript(): string {
  return `<script>if (self.parent.checkPublicacao) self.parent.checkPublicacao(); self.parent.caixaMsg.exibir({titulo:'Sucesso',conteudo:'A operação foi realizada com sucesso! !',classe:'ok'});</script>`;
}

/** Com a sessão vencida, toda página é só isto (seção 7, observado em 14/10/2026). */
export const LOGON_REDIRECT = `<script>
  location = 'pkg_sec.logon?f_cod=ini';
</script>`;
