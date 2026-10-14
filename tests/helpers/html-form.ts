// Lê um <form> de uma página HTML como a extensão lê com o DOMParser
// (extension/src/lattes-runner.ts), só com expressões regulares: os testes
// rodam sem DOM. Cobre o que as páginas falsas do Lattes usam: input, select
// com option e textarea, em ordem.

import type { FormControl } from '../../src/bridge/form.ts';
import { decodeHtmlEntities } from '../../src/bridge/html-text.ts';

function attrs(tag: string): Record<string, string> {
  const out: Record<string, string> = {};
  const inner = tag.replace(/^<\w+/, '').replace(/\/?>$/, '');
  for (const m of inner.matchAll(/([\w-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) {
    out[m[1]!.toLowerCase()] = decodeHtmlEntities(m[2] ?? m[3] ?? m[4] ?? '');
  }
  return out;
}

const maxLength = (a: Record<string, string>) => {
  const n = Number(a.maxlength);
  return n > 0 ? n : undefined;
};

/** Os controles do formulário com esse name, ou undefined se a página não o tem. */
export function readHtmlForm(html: string, formName: string): FormControl[] | undefined {
  const form = new RegExp(
    `<form\\b[^>]*\\bname\\s*=\\s*["']?${formName}["'\\s>][^>]*>([\\s\\S]*?)</form>`,
    'i',
  ).exec(html);
  if (!form) return undefined;
  const body = form[1] ?? '';
  const controls: FormControl[] = [];
  const tags =
    /<input\b[^>]*>|<select\b[^>]*>([\s\S]*?)<\/select>|<textarea\b[^>]*>([\s\S]*?)<\/textarea>/gi;
  for (const m of body.matchAll(tags)) {
    const tag = /^<\w+[^>]*>/.exec(m[0])![0];
    const a = attrs(tag);
    const disabled = 'disabled' in a;
    if (m[0].toLowerCase().startsWith('<select')) {
      const options = [...(m[1] ?? '').matchAll(/<option\b([^>]*)>([^<]*)/gi)].map((o) => {
        const oa = attrs(`<option${o[1]}>`);
        return { selected: 'selected' in oa, value: oa.value ?? decodeHtmlEntities(o[2]!).trim() };
      });
      const chosen = options.filter((o) => o.selected).map((o) => o.value);
      // Sem opção marcada, o navegador escolhe a primeira; sem opção nenhuma, nada.
      const selected = chosen.length ? chosen : options.slice(0, 1).map((o) => o.value);
      controls.push({
        disabled,
        name: a.name ?? '',
        selected,
        type: 'multiple' in a ? 'select-multiple' : 'select-one',
        value: selected[0] ?? '',
      });
      continue;
    }
    if (m[0].toLowerCase().startsWith('<textarea')) {
      controls.push({
        disabled,
        maxLength: maxLength(a),
        name: a.name ?? '',
        type: 'textarea',
        value: decodeHtmlEntities(m[2] ?? ''),
      });
      continue;
    }
    const type = (a.type ?? 'text').toLowerCase();
    controls.push({
      checked: 'checked' in a,
      disabled,
      maxLength: maxLength(a),
      name: a.name ?? '',
      type,
      value: a.value ?? (type === 'checkbox' || type === 'radio' ? 'on' : ''),
    });
  }
  return controls;
}
