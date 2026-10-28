// O órgão e a unidade de um projeto novo, no próprio projeto. No XML eles
// ficam na participação (o pai do projeto), que o editor mostra só na
// atuação; o Lattes os exige na inclusão do projeto e não os troca depois
// (docs/lattes_internals.md, seção 21). Num projeto que já está no Lattes,
// nada aparece aqui.

import { ORGAN_PARTS } from '../bridge/production/organ.ts';
import type { XElement } from '../model/xml.ts';
import { AttributeField, type EditFn } from './AttributeField.tsx';
import { useEditor } from './editor-context.ts';
import { useFormLacks } from './form-lacks-context.ts';
import { ancestorsOf } from './live-lists.ts';

export function ProjectOrgan({ el, onEdit }: { el: XElement; onEdit: EditFn }) {
  const { root } = useEditor();
  const formLacks = useFormLacks();
  if (el.name !== 'PROJETO-DE-PESQUISA') return null;
  const participacao = ancestorsOf(root, el).at(-1);
  if (participacao?.name !== ORGAN_PARTS.holder || !formLacks?.isNew?.(participacao)) return null;
  return (
    <section className="subsection">
      <h4 className="subsection-head">Órgão/Unidade</h4>
      <div className="fields cols-2">
        <AttributeField required el={participacao} name={ORGAN_PARTS.organ.name} onEdit={onEdit} />
        <AttributeField el={participacao} name={ORGAN_PARTS.unit.name} onEdit={onEdit} />
      </div>
    </section>
  );
}
