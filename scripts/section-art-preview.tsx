// Prancha local de revisão dos SVGs usados pelo app, servida pelo Vite em
// /brand/sections/. Usa os componentes reais para acompanhar cada alteração.

import '../src/ui/styles.css';
import './section-art-preview.css';

import { useState } from 'react';
import { createRoot } from 'react-dom/client';

import { parseXml } from '../src/model/xml.ts';
import { Brand } from '../src/ui/Brand.tsx';
import { SectionArt } from '../src/ui/empty-art.tsx';
import { EmptySection } from '../src/ui/EmptySection.tsx';
import { PlusIcon } from '../src/ui/icons.tsx';
import { buildSections } from '../src/ui/sections.ts';

const SECTIONS = buildSections(parseXml('<CURRICULO-VITAE/>').root);

function Preview() {
  const [dark, setDark] = useState(() => {
    const theme = document.documentElement.dataset.theme;
    return (
      theme === 'dark' || (theme !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches)
    );
  });
  const [grid, setGrid] = useState(false);
  const [selected, setSelected] = useState('projetos');
  const section = SECTIONS.find((s) => s.id === selected)!;

  return (
    <main className={`section-art-preview${grid ? ' show-grid' : ''}`}>
      <header className="art-preview-header">
        <Brand />
        <div className="art-preview-controls">
          <label>
            <input checked={grid} type="checkbox" onChange={(e) => setGrid(e.target.checked)} />
            Grade de construção
          </label>
          <button
            type="button"
            onClick={() => {
              document.documentElement.dataset.theme = dark ? 'light' : 'dark';
              setDark(!dark);
            }}
          >
            {dark ? 'Tema claro' : 'Tema escuro'}
          </button>
        </div>
      </header>
      <h1>Ícones das seções</h1>
      <p className="art-preview-intro">
        Ícones dos estados vazios · 96 × 96 px · módulo x = 8 px · malha fina x/8
      </p>
      <div className="art-preview-grid">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            aria-pressed={selected === s.id}
            className="art-preview-card"
            type="button"
            onClick={() => setSelected(s.id)}
          >
            <span className="art-preview-drawing">
              <SectionArt sectionId={s.id} />
            </span>
            <span>{s.label}</span>
          </button>
        ))}
      </div>
      <footer className="art-preview-rules">
        <p>
          <strong>Proporções da marca</strong>
          Hastes de x. Anéis: diâmetro externo 1,75x e interno 0,75x. Cortes a 45°. Na conexão de
          Projetos, o vão perpendicular é x/4.
        </p>
        <p>
          <strong>Cor e detalhes</strong>
          Violeta #463C6D. Menta #2C8979 no tema claro e #9EF2E2 no escuro. No tema escuro, o
          violeta acompanha o branco da assinatura. As barras mantêm a espessura e o ritmo do logo.
        </p>
      </footer>
      <section className="art-preview-context" aria-label="Prévia de seção vazia">
        <h2>{section.label}</h2>
        <EmptySection
          action={
            <button className="primary" type="button">
              <PlusIcon /> Ação da seção
            </button>
          }
          section={section}
          onNewItem={() => {}}
          onOpenPicker={() => {}}
        />
      </section>
      <details className="art-preview-fallback">
        <summary>Desenho para seções sem ícone próprio</summary>
        <SectionArt sectionId="fallback" />
      </details>
    </main>
  );
}

const root = createRoot(document.getElementById('root')!);
root.render(<Preview />);

if (import.meta.hot) {
  import.meta.hot.dispose(() => root.unmount());
}
