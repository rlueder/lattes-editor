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
    // Os grupos sem nada preenchido começam fechados, com o título à mostra.
    expect(html).toContain('Filiação');
    expect(html).toContain('Nascimento');
    // Os campos só de tela que a cópia não tem também aparecem, vazios.
    expect(html).toContain('Deseja utilizar o nome social?');
  });
});

describe('modo de leitura: campos só de tela', () => {
  it('o valor de sempre (público) não aparece; o privado aparece com o assunto', () => {
    const html = (priv: string) =>
      renderToStaticMarkup(
        createElement(ReadingGroup, {
          elements: [
            el(
              `<DADOS-GERAIS NOME-COMPLETO="Ana Beatriz Lima" tela:f_priv_cor="${priv}" tela:f_nome_social_r="N"/>`,
            ),
          ],
          label: 'Identificação',
          list: null,
          onEdit,
        }),
      );
    expect(html('1')).not.toContain('Visibilidade');
    expect(html('1')).not.toContain('nome social');
    expect(html('2')).toContain('Visibilidade da cor ou raça');
    expect(html('2')).toContain('Privado');
  });
});
