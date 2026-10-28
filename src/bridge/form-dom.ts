// Os campos de um <form> como o navegador os vê, para quem tem DOM: a aba do
// Lattes (extension/src/lattes-runner.ts) e o editor, que lê no próprio
// navegador as páginas que a aba buscou (src/bridge/load/).

import type { FormControl } from './form.ts';

export function controlsOf(form: HTMLFormElement): FormControl[] {
  return [...form.elements].map((el) => {
    const c = el as HTMLInputElement & HTMLSelectElement & HTMLTextAreaElement;
    const isSelect = c.tagName === 'SELECT';
    return {
      checked: c.checked,
      disabled: c.disabled,
      maxLength: c.maxLength > 0 ? c.maxLength : undefined,
      name: c.name,
      selected: isSelect ? [...c.selectedOptions].map((o) => o.value) : undefined,
      type: isSelect ? c.type || 'select-one' : (c.type || c.tagName).toLowerCase(),
      value: c.value,
    };
  });
}

/** O <form> com esse nome numa página, lido por DOMParser. */
export function readFormInPage(html: string, formName: string): FormControl[] | undefined {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const form = doc.querySelector<HTMLFormElement>(`form[name="${formName}"]`);
  return form ? controlsOf(form) : undefined;
}
