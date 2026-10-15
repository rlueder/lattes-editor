// Listas dentro de listas na leitura (src/ui/nested-collapse.ts): o registro e
// o primeiro nível abertos, do segundo para baixo fechados numa linha de
// texto; a memória por item; o campo em foco e a busca abrem a lista.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { loadCv } from '../src/model/document.ts';
import { walk, type XElement } from '../src/model/xml.ts';
import { recordSearchText } from '../src/ui/facets.ts';
import {
  actionWord,
  collapsedText,
  FocusPartContext,
  groupKeys,
  groupText,
  mustExpand,
  NestedScopeContext,
  ReadingQueryContext,
  rememberedNested,
  rememberNested,
  startsCollapsed,
} from '../src/ui/nested-collapse.ts';
import { recordLayout } from '../src/ui/reading-records.ts';
import { SectionView } from '../src/ui/ReadingParts.tsx';

const opts = { hideSensitive: false, showCodes: false };

async function atuacao(): Promise<XElement> {
  const bytes = new Uint8Array(readFileSync(join(import.meta.dirname, '../fixtures/demo.xml')));
  const root = (await loadCv(bytes, 'demo.xml')).doc.root;
  let found: XElement | undefined;
  walk(root, (e) => {
    if (!found && e.name === 'ATUACAO-PROFISSIONAL' && /Genômica/.test(JSON.stringify(e))) {
      found = e;
    }
  });
  return found!;
}

/** O grupo "Projeto" (segundo nível) e a equipe dentro dele (terceiro). */
async function levels() {
  const el = await atuacao();
  const s = recordLayout(el, false, opts);
  const activities = s.nested.find((g) => /Atividades/.test(g.label))!;
  const project = activities.items[0]!.nested[0]!;
  const team = project.items[0]!.nested.find((g) => /Equipe/.test(g.label))!;
  return { el, project, s, team };
}

describe('quais níveis fecham', () => {
  it('o registro e o primeiro nível ficam abertos; do segundo para baixo, fechados', () => {
    expect(startsCollapsed(1)).toBe(false);
    expect(startsCollapsed(2)).toBe(true);
    expect(startsCollapsed(3)).toBe(true);
  });
});

describe('a linha da lista fechada', () => {
  it('um item com título: rótulo e título, "ver detalhes"; vários: contagem, "mostrar"', async () => {
    const { project, team } = await levels();
    expect(collapsedText(project, project.items)).toMatch(/^Projeto: Genômica da conservação/);
    expect(actionWord(false, project.items, true)).toBe('ver detalhes');
    expect(team.people).toBe(true);
    expect(collapsedText(team, team.items)).toBe(
      `Equipe do projeto · ${team.items.length} pessoas`,
    );
    expect(actionWord(false, team.items, false)).toBe('mostrar');
    expect(actionWord(true, team.items, false)).toBe('ocultar');
  });

  it('conta no singular e diz "itens" fora das listas de pessoas', async () => {
    const { project, team } = await levels();
    expect(collapsedText(team, team.items.slice(0, 1))).toBe('Equipe do projeto · 1 pessoa');
    const untitled = { ...project.items[0]!, lines: [] };
    expect(collapsedText({ ...project, people: false }, [untitled])).toBe('Projeto · 1 item');
    expect(collapsedText({ ...project, people: false }, [untitled, untitled])).toBe(
      'Projeto · 2 itens',
    );
  });
});

describe('abre sozinha', () => {
  it('com o campo em foco dentro dela ou com um resultado da busca', async () => {
    const { project, team } = await levels();
    const key = groupKeys(team)[0]!;
    expect(mustExpand(team, key, '')).toBe(true);
    // O campo da equipe está dentro do projeto também: o caminho todo abre.
    expect(mustExpand(project, key, '')).toBe(true);
    expect(mustExpand(team, null, '')).toBe(false);
    expect(mustExpand(project, null, 'palmeiras')).toBe(true);
    expect(mustExpand(team, null, 'palmeiras')).toBe(false);
    expect(groupText(project)).toMatch(/palmeiras/);
  });

  it('a busca da seção acha o registro pelo que está nas listas dentro dele', async () => {
    const { el } = await levels();
    expect(recordSearchText({ subtitle: '', title: 'UFRGS' }, el)).toMatch(/palmeiras/);
  });
});

describe('memória por item, na sessão', () => {
  it('guarda aberta ou fechada pelo item e pela posição da lista', async () => {
    const { el } = await levels();
    expect(rememberedNested(el, '5')).toBeUndefined();
    rememberNested(el, '5', true);
    expect(rememberedNested(el, '5')).toBe(true);
    expect(rememberedNested(null, '5')).toBeUndefined();
    rememberNested(null, '5', true);
    rememberNested(el, undefined, true);
    expect(rememberedNested(el, undefined)).toBeUndefined();
  });
});

describe('na tela', () => {
  const render = (s: Parameters<typeof SectionView>[0]['section'], ctx = {}) => {
    const {
      focus = null,
      query = '',
      scope = null,
    } = ctx as {
      focus?: string | null;
      query?: string;
      scope?: XElement | null;
    };
    return renderToStaticMarkup(
      createElement(
        NestedScopeContext.Provider,
        { value: scope },
        createElement(
          FocusPartContext.Provider,
          { value: focus },
          createElement(
            ReadingQueryContext.Provider,
            { value: query },
            createElement(SectionView, { section: s }),
          ),
        ),
      ),
    );
  };

  it('primeiro nível com rótulo; os de baixo, botão com aria-expanded e a lista escondida', async () => {
    const { s } = await levels();
    const html = render(s);
    expect(html).toContain(
      '<p class="reading-nested-label">Atividades de participação em projeto</p>',
    );
    expect(html).toMatch(/aria-expanded="false" class="reading-nested-toggle"/);
    expect(html).toContain('ver detalhes');
    expect(html).toMatch(/<ul hidden="" id="[^"]+">/);
  });

  it('o campo em foco abre o caminho até ele', async () => {
    const { s, team } = await levels();
    const html = render(s, { focus: groupKeys(team)[0] });
    expect(html).not.toContain('aria-expanded="false"');
    expect(html).toContain('ocultar');
  });

  it('a lista aberta antes, no mesmo item, volta aberta', async () => {
    const { el, project, s } = await levels();
    rememberNested(el, project.id, true);
    const html = render(s, { scope: el });
    expect(html).toContain('Projeto</span>');
    expect(html).toMatch(/Equipe do projeto · \d+ pessoas/);
    rememberNested(el, project.id, false);
  });
});
