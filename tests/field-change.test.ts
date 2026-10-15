// Campo alterado no "Enviar ao Lattes" (src/ui/FieldChange.tsx), o mesmo nas
// abas "A enviar" e "Enviado": rótulo em cima, "Antes" e "Depois" lado a lado.

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { FieldChange } from '../src/ui/FieldChange.tsx';

const render = (props: Parameters<typeof FieldChange>[0]) =>
  renderToStaticMarkup(createElement(FieldChange, props));

describe('campo alterado', () => {
  it('rótulo em cima e as duas colunas, com as legendas no primeiro campo', () => {
    const html = render({
      after: '2016',
      before: '2018',
      captions: true,
      label: 'Ano de conclusão',
    });
    expect(html).toMatch(/fc-label">Ano de conclusão<\/div><div class="fc-cols">/);
    expect(html).toContain('<span class="fc-caption">Antes</span>');
    expect(html).toContain('<span class="fc-caption">Depois</span>');
  });

  it('sem legenda à vista, o leitor de tela ainda ouve "Antes" e "Depois"', () => {
    const html = render({ after: 'b', before: 'a', label: 'X' });
    expect(html).not.toContain('fc-caption');
    expect(html).toContain('<span class="sr-only">Antes: </span>');
  });

  it('valor antigo vazio aparece como "(vazio)", sem risco', () => {
    const html = render({ after: 'FX123', before: '', label: 'Passaporte' });
    expect(html).toContain('<span class="fc-empty">(vazio)</span>');
  });

  it('texto longo para em quatro linhas, com "mostrar tudo"', () => {
    const html = render({ after: 'x '.repeat(200), before: 'curto', label: 'Resumo' });
    expect(html).toContain('fc-text is-clamped');
    expect(html).toContain('mostrar tudo');
  });

  it('item novo ou que sai: uma coluna só', () => {
    expect(render({ after: 'Novo', label: 'Título' })).toContain('fc-cols is-single');
  });
});
