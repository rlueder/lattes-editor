// O modo de leitura na tela: a leitura esconde os campos vazios, a edição
// mostra todos, e não há botão para alternar entre os dois.

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { parseXml } from '../src/model/xml.ts';
import { EditForm, ReadingGroup } from '../src/ui/ReadingView.tsx';

const el = (xml: string) => parseXml(xml).root;
const onEdit = () => {};

describe('modo de leitura: campos vazios', () => {
  const dg = () =>
    el('<DADOS-GERAIS NOME-COMPLETO="Ana Beatriz Lima" NOME-DO-PAI="" CIDADE-NASCIMENTO=""/>');

  it('a leitura mostra só os campos preenchidos', () => {
    const html = renderToStaticMarkup(
      createElement(ReadingGroup, { elements: [dg()], label: 'Identificação', list: null, onEdit }),
    );
    expect(html).toContain('Ana Beatriz Lima');
    expect(html).toContain('Nome completo');
    expect(html).not.toContain('Nome do pai');
    expect(html).not.toContain('Cidade nascimento');
  });

  it('não há botão para mostrar ou esconder campos vazios', () => {
    const html = renderToStaticMarkup(
      createElement(ReadingGroup, { elements: [dg()], label: 'Identificação', list: null, onEdit }),
    );
    expect(html).not.toMatch(/campos? vazios?/i);
    expect(html).toContain('Editar');
  });

  it('a edição mostra todos os campos, inclusive os vazios', () => {
    const html = renderToStaticMarkup(createElement(EditForm, { el: dg(), onEdit }));
    expect(html).toContain('Nome completo');
    expect(html).toContain('Nome do pai');
    expect(html).toContain('Cidade nascimento');
  });
});
