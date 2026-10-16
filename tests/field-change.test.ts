// Campo alterado no "Enviar ao Lattes" (src/ui/FieldChange.tsx), o mesmo nas
// abas "A enviar" e "Enviado": uma célula da grade de campos do item, com o
// rótulo em cima e, num campo alterado, o valor de antes riscado sobre o de
// depois. E a regra de que campos aparecem e quanto espaço ocupam
// (src/ui/change-fields.ts).

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import type { Change } from '../src/model/changes.ts';
import { fieldSpan, isLongText, visibleFields } from '../src/ui/change-fields.ts';
import { FieldChange } from '../src/ui/FieldChange.tsx';

const render = (props: Parameters<typeof FieldChange>[0]) =>
  renderToStaticMarkup(createElement(FieldChange, props));

describe('campo alterado', () => {
  it('rótulo em cima, antes e depois embaixo, com as legendas no primeiro campo', () => {
    const html = render({
      after: '2016',
      before: '2018',
      captions: true,
      label: 'Ano de conclusão',
    });
    expect(html).toMatch(/^<div class="fc is-edit"><div class="fc-head">/);
    expect(html).toContain(
      '<span class="fc-label" title="Ano de conclusão">Ano de conclusão</span>',
    );
    expect(html).toContain('<span class="fc-caption">Antes</span>');
    expect(html).toContain('<span class="fc-caption">Depois</span>');
    expect(html.indexOf('fc-before')).toBeLessThan(html.indexOf('fc-after'));
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

  it('texto longo ocupa a linha inteira e para em quatro linhas, com "Ler mais"', () => {
    const html = render({ after: 'x '.repeat(200), before: 'curto', label: 'Resumo' });
    expect(html).toMatch(/^<div class="fc is-edit span-all">/);
    expect(html).toContain('fc-text is-clamped');
    expect(html).toContain('Ler mais');
  });

  it('item novo ou que sai: só o valor, numa célula', () => {
    const html = render({ after: 'Novo', label: 'Título' });
    expect(html).toMatch(/^<div class="fc">/);
    expect(html).not.toContain('fc-before');
  });

  it('a lixeira fica ao lado do rótulo', () => {
    const html = render({
      actions: createElement('button', null, 'x'),
      after: 'b',
      before: 'a',
      label: 'X',
    });
    expect(html).toContain('<span class="fc-actions"><button>x</button></span>');
  });
});

describe('espaço de um campo na grade', () => {
  it('curto numa coluna, médio em duas, longo na linha inteira', () => {
    expect(fieldSpan(['2026'])).toBe(1);
    expect(fieldSpan(['Universidade do Vale do Rio'])).toBe(2);
    expect(fieldSpan(['a'.repeat(60)])).toBe(3);
  });

  it('num campo alterado, vale o valor mais longo dos dois', () => {
    expect(fieldSpan(['2018', 'Universidade do Vale do Rio'])).toBe(2);
    expect(fieldSpan(['', '2016'])).toBe(1);
  });

  it('texto com quebra de linha conta como longo', () => {
    expect(isLongText('linha um\nlinha dois')).toBe(true);
    expect(isLongText('x'.repeat(241))).toBe(true);
    expect(isLongText('x'.repeat(240))).toBe(false);
    expect(fieldSpan(['a\nb'])).toBe(3);
  });
});

describe('campos que aparecem na lista', () => {
  const field = (attr: string, after = 'x') => ({ after, attr, before: '', label: attr });
  const mestrado: Change = {
    element: 'MESTRADO-PROFISSIONALIZANTE',
    fields: [
      field('SEQUENCIA-FORMACAO', '15'),
      field('CODIGO-INSTITUICAO', '000900000007'),
      field('NOME-INSTITUICAO'),
      field('CODIGO-CURSO', '60056215'),
      field('NOME-CURSO'),
      field('STATUS-DO-CURSO'),
      field('ANO-DE-INICIO', '2026'),
      field('FLAG-BOLSA', 'NAO'),
      field('CODIGO-CURSO-CAPES', '42007011021P4'),
    ],
    form: 'Mestrado profissionalizante',
    key: 'k',
    kind: 'novo',
    path: [],
  };

  it('sem os códigos que o Lattes gera (sequência, instituição, curso, CAPES)', () => {
    expect(visibleFields(mestrado, false).map((f) => f.attr)).toEqual([
      'NOME-INSTITUICAO',
      'NOME-CURSO',
      'STATUS-DO-CURSO',
      'ANO-DE-INICIO',
      'FLAG-BOLSA',
    ]);
  });

  it('com "Mostrar códigos do Lattes" ligado, todos', () => {
    expect(visibleFields(mestrado, true)).toHaveLength(9);
  });

  it('o número do registro ou da patente é digitado: fica à vista', () => {
    const patente: Change = {
      ...mestrado,
      element: 'DADOS-BASICOS-DA-PATENTE',
      fields: [field('CODIGO-DO-REGISTRO-OU-PATENTE')],
      kind: 'alterado',
    };
    expect(visibleFields(patente, false)).toHaveLength(1);
  });

  it('alteração só de códigos: os códigos aparecem, para o item não ficar vazio', () => {
    const onlyCodes: Change = { ...mestrado, fields: [field('CODIGO-INSTITUICAO')] };
    expect(visibleFields(onlyCodes, false)).toHaveLength(1);
  });
});
