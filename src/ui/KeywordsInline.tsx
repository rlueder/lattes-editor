// Palavras-chave num item que ainda não tem nenhuma, no formulário da linha
// (ReadingView). Com palavras, elas aparecem como os outros campos do item
// (PALAVRAS-CHAVE entra em MERGED, ElementView.tsx); sem o elemento, não havia
// onde digitá-las fora do formulário de item novo (ProductionForm).

import { useId, useState } from 'react';

import { elementLabel } from '../labels/labels.ts';
import { setKeywords } from '../model/production.ts';
import type { XElement } from '../model/xml.ts';
import { lattesSchema } from '../schema/lattes.ts';
import type { EditFn } from './AttributeField.tsx';
import { parseKeywords } from './keywords-inline.ts';

export function KeywordsInline({ el, onEdit }: { el: XElement; onEdit: EditFn }) {
  const id = useId();
  const [draft, setDraft] = useState('');
  return (
    <div className="field field-wide">
      <label htmlFor={id}>Palavras-chave</label>
      <input
        id={id}
        placeholder="Até 6, separadas por vírgula"
        value={draft}
        onBlur={() => {
          const words = parseKeywords(draft);
          if (words.length === 0) return;
          setKeywords(lattesSchema, el, words);
          onEdit(`${elementLabel(el.name)} · Palavras-chave`);
        }}
        onChange={(e) => setDraft(e.target.value)}
      />
    </div>
  );
}
