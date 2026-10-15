// Formulário longo em partes (src/ui/disclosure.ts): quais grupos começam
// abertos, a linha do grupo fechado, a memória da sessão e os campos que o
// tipo do curso esconde.

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it } from 'vitest';

import { sectionFacts } from '../src/forms/form-sections.ts';
import { parseXml } from '../src/model/xml.ts';
import {
  closedLine,
  FEW_FILLED_MAX,
  filledLabel,
  FLAT_FORM_MAX,
  type GroupFacts,
  groupSummary,
  initialGroups,
  mustOpen,
  rememberedGroup,
  rememberGroup,
  resetRememberedGroups,
  SUMMARY_MAX,
  switchedOff,
} from '../src/ui/disclosure.ts';
import { EditForm } from '../src/ui/ReadingView.tsx';

const el = (xml: string) => parseXml(xml).root;
const group = (label: string, extra: Partial<GroupFacts> = {}): GroupFacts => ({
  error: false,
  filled: 0,
  label,
  required: false,
  target: false,
  ...extra,
});

afterEach(() => resetRememberedGroups());

describe('grupos que começam abertos', () => {
  const long = { editing: false, fields: FLAT_FORM_MAX + 1 };

  it('formulário curto fica inteiro aberto, sem grupo que fecha', () => {
    const out = initialGroups([group('A'), group('B')], { editing: false, fields: FLAT_FORM_MAX });
    expect(out).toEqual([
      { collapsible: false, open: true },
      { collapsible: false, open: true },
    ]);
  });

  it('um grupo só também não fecha', () => {
    expect(initialGroups([group('A')], long)).toEqual([{ collapsible: false, open: true }]);
  });

  it('no longo, o primeiro fica aberto e os outros fecham', () => {
    const out = initialGroups([group('A'), group('B'), group('C')], long);
    expect(out[0]).toEqual({ collapsible: false, open: true });
    expect(out[1]).toEqual({ collapsible: true, open: false });
  });

  it('obrigatório, erro e campo para onde se pulou abrem o grupo', () => {
    const out = initialGroups(
      [
        group('A'),
        group('B', { required: true }),
        group('C', { error: true }),
        group('D', { target: true }),
      ],
      long,
    );
    expect(out.slice(1).every((g) => g.open)).toBe(true);
    expect(mustOpen({ error: false, required: false, target: false })).toBe(false);
  });

  it('na edição com poucos valores, os grupos com valor abrem; com muitos, não', () => {
    const edit = { editing: true, fields: 20 };
    const few = initialGroups([group('A'), group('B', { filled: 2 }), group('C')], edit);
    expect(few.map((g) => g.open)).toEqual([true, true, false]);
    const many = initialGroups(
      [group('A', { filled: FEW_FILLED_MAX }), group('B', { filled: 2 })],
      edit,
    );
    expect(many[1]!.open).toBe(false);
    // Item novo: valor não abre grupo.
    expect(initialGroups([group('A'), group('B', { filled: 1 })], long)[1]!.open).toBe(false);
  });

  it('o que a pessoa abriu ou fechou nesta sessão vale para o grupo de mesmo nome', () => {
    rememberGroup('Em inglês', true);
    expect(rememberedGroup('Em inglês')).toBe(true);
    expect(initialGroups([group('A'), group('Em inglês')], long)[1]!.open).toBe(true);
    rememberGroup('Em inglês', false);
    // Fechado na memória, mas com obrigatório: abre do mesmo jeito.
    const out = initialGroups([group('A'), group('Em inglês', { required: true })], long);
    expect(out[1]!.open).toBe(true);
    resetRememberedGroups();
    expect(rememberedGroup('Em inglês')).toBeUndefined();
  });
});

describe('a linha do grupo fechado', () => {
  it('conta os preenchidos no singular e no plural, e nada sem valor', () => {
    expect(filledLabel(0)).toBe('');
    expect(filledLabel(1)).toBe('1 preenchido');
    expect(filledLabel(3)).toBe('3 preenchidos');
  });

  it('resume poucos valores curtos, sem vazios nem textos longos', () => {
    const v = (attr: string, value: string) => ({ attr, value });
    expect(
      groupSummary([
        v('NATUREZA', 'Pesquisa'),
        v('DESCRICAO-DO-PROJETO', 'Curta, mas é descrição'),
        v('ANO-FIM', ''),
        v('SITUACAO', '  Em\n andamento '),
        v('TITULO', 'x'.repeat(SUMMARY_MAX * 30)),
        v('ANO-INICIO', '2020'),
        v('NUMERO-GRADUACAO', '2'),
      ]),
    ).toBe('Pesquisa, Em andamento, 2020');
  });

  it('a linha do grupo fechado separa com espaço dos dois lados', () => {
    expect(closedLine(7, 'Pesquisa, Em andamento')).toBe('7 preenchidos · Pesquisa, Em andamento');
    expect(closedLine(0, '')).toBe('');
    expect(closedLine(1, '')).toBe('1 preenchido');
  });

  it('as partes do item novo: valores, obrigatório e erro', () => {
    const item = el(
      '<PROJETO-DE-PESQUISA NOME-DO-PROJETO="Genômica" NATUREZA="" ANO-INICIO="2020"/>',
    );
    const facts = sectionFacts(
      'Projeto',
      item,
      [{ attr: 'NOME-DO-PROJETO', required: true }, { attr: 'NATUREZA' }, { attr: 'ANO-INICIO' }],
      (attr) => attr === 'NATUREZA',
    );
    expect(facts).toMatchObject({ error: true, filled: 2, label: 'Projeto', required: true });
    expect(facts.summary).toBe('Genômica, 2020');
  });
});

describe('sanduíche e cotutela só depois do tipo', () => {
  const doutorado = (tipo: string, orientador = '') =>
    el(
      `<DOUTORADO NOME-INSTITUICAO="UFRGS" TIPO-DOUTORADO="${tipo}" NOME-DO-ORIENTADOR-SANDUICHE="${orientador}"/>`,
    );

  it('normal ou vazio esconde; outro tipo mostra; valor preenchido nunca some', () => {
    expect(switchedOff(doutorado(''), 'NOME-DO-ORIENTADOR-SANDUICHE')).toBe(true);
    expect(switchedOff(doutorado('N'), 'NOME-DO-ORIENTADOR-SANDUICHE')).toBe(true);
    expect(switchedOff(doutorado('S'), 'NOME-DO-ORIENTADOR-SANDUICHE')).toBe(false);
    expect(switchedOff(doutorado('N', 'Helena'), 'NOME-DO-ORIENTADOR-SANDUICHE')).toBe(false);
    expect(switchedOff(doutorado('N'), 'NOME-INSTITUICAO')).toBe(false);
  });

  it('elemento sem o campo que decide não esconde nada', () => {
    const graduacao = el('<PROJETO-DE-PESQUISA NOME-DO-ORIENTADOR-SANDUICHE=""/>');
    expect(switchedOff(graduacao, 'NOME-DO-ORIENTADOR-SANDUICHE')).toBe(false);
  });
});

describe('na edição de um bloco', () => {
  it('formulário longo: grupos fechados viram botão com aria-expanded e o resumo', () => {
    const projeto = el(
      `<PROJETO-DE-PESQUISA NOME-DO-PROJETO="Genômica da conservação" DESCRICAO-DO-PROJETO="" NATUREZA="PESQUISA"
        SITUACAO="EM_ANDAMENTO" ANO-INICIO="2020" ANO-FIM="" FLAG-POTENCIAL-INOVACAO="NAO" NUMERO-GRADUACAO="2"
        NUMERO-ESPECIALIZACAO="" NUMERO-MESTRADO-ACADEMICO="1" NUMERO-MESTRADO-PROF="" NUMERO-DOUTORADO="3"
        NOME-DO-PROJETO-INGLES="" DESCRICAO-DO-PROJETO-INGLES=""/>`,
    );
    const html = renderToStaticMarkup(createElement(EditForm, { el: projeto, onEdit: () => {} }));
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('disclosure-toggle');
    expect(html).toContain('Em inglês');
    // Item com valores demais para abrir tudo: "Alunos envolvidos" fecha com o resumo.
    expect(html).toContain(
      'Alunos envolvidos</span><span class="disclosure-line"> · 3 preenchidos · 2, 1, 3</span>',
    );
    // O botão não leva a classe dos títulos de grupo: só o título tem esse estilo.
    expect(html).toContain('class="disclosure-toggle"');
  });

  it('o sanduíche some do doutorado normal e aparece no sanduíche', () => {
    const render = (tipo: string) =>
      renderToStaticMarkup(
        createElement(EditForm, {
          el: el(
            `<DOUTORADO NOME-INSTITUICAO="UFRGS" TIPO-DOUTORADO="${tipo}" NOME-DO-ORIENTADOR-SANDUICHE=""/>`,
          ),
          onEdit: () => {},
        }),
      );
    expect(render('N')).not.toContain('Orientador no sanduíche');
    expect(render('S')).toContain('Orientador no sanduíche');
  });
});
