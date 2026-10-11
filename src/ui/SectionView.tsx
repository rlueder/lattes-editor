import { type EditFn, ElementView } from './ElementView.tsx';
import { ItemList } from './ItemList.tsx';
import { JumpBar } from './JumpBar.tsx';
import { countItems, type Section } from './sections.ts';

interface Props {
  section: Section;
  showEmpty: boolean;
  /** Muda a cada edição; remonta as listas para refletir o documento mutado. */
  version: number;
  onEdit: EditFn;
}

export function SectionView({ onEdit, section, showEmpty, version }: Props) {
  return (
    <>
      <div className="section-head">
        <h1>{section.label}</h1>
        {section.importable === false && (
          <span
            className="badge"
            title="O Importar do Lattes ignora esta seção; copie as mudanças à mão no Lattes."
          >
            não importável no Lattes
          </span>
        )}
      </div>
      {section.importable === 'filtro' && (
        <p className="muted section-note">
          Itens de outras seções reunidos pela marca do Lattes. Cada um é importável ou não conforme
          a seção de origem.
        </p>
      )}
      {section.groups.length === 0 && <p className="muted">Nada nesta seção.</p>}
      <div key={section.id} className="section-body">
        {section.groups.length > 1 && (
          <JumpBar
            entries={section.groups.map((g) => ({
              count: countItems(g),
              id: g.id,
              label: g.label,
            }))}
            label="Grupos da seção"
            level="section"
          />
        )}
        {section.groups.map((g) => (
          <section key={g.id} className="group" id={g.id}>
            <h2>{g.label}</h2>
            {g.elements.length > 1 ? (
              <ItemList key={version} items={g.elements} showEmpty={showEmpty} onEdit={onEdit} />
            ) : (
              g.elements.map((el, i) => (
                <ElementView
                  key={`${version}-${i}`}
                  el={el}
                  showEmpty={showEmpty}
                  onEdit={onEdit}
                />
              ))
            )}
          </section>
        ))}
      </div>
    </>
  );
}
