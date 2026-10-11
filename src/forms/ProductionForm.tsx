// Formulário de um item de produção, novo ou ainda não importado. Trabalha
// sobre uma cópia; nada entra no documento até "Salvar".

import { useMemo, useState } from 'react';

import { attributeLabel, elementLabel } from '../labels/labels.ts';
import { applyCrossref, crossrefAuthors, itemNameFor } from '../lookups/crossref.ts';
import { DoiLookup } from '../lookups/DoiLookup.tsx';
import {
  type Author,
  authorElementName,
  itemPart,
  readAuthors,
  readKeywords,
  setAuthors,
  setKeywords,
} from '../model/production.ts';
import { validateItem } from '../model/validate.ts';
import type { XElement } from '../model/xml.ts';
import { lattesSchema as schema } from '../schema/lattes.ts';
import { AttributeField } from '../ui/AttributeField.tsx';
import { Attributes } from '../ui/ElementView.tsx';
import { Modal } from '../ui/Modal.tsx';
import { AuthorsEditor } from './AuthorsEditor.tsx';
import { formSpec, missingRequired } from './specs.ts';

/** Tipos que o mapeamento do Crossref sabe preencher. */
const DOI_TYPES = new Set([
  'ARTIGO-PUBLICADO',
  'TRABALHO-EM-EVENTOS',
  'CAPITULO-DE-LIVRO-PUBLICADO',
  'LIVRO-PUBLICADO-OU-ORGANIZADO',
]);

interface Props {
  isNew: boolean;
  item: XElement;
  knownAuthors: Author[];
  /** Número que o item vai receber (novo) ou tem (existente). */
  sequencia: number;
  onCancel: () => void;
  onRemove?: () => void;
  onSave: (item: XElement) => void;
}

export function ProductionForm({
  isNew,
  item,
  knownAuthors,
  onCancel,
  onRemove,
  onSave,
  sequencia,
}: Props) {
  const [version, setVersion] = useState(0);
  const [showAll, setShowAll] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const touch = () => setVersion((v) => v + 1);

  const spec = formSpec(item.name);
  const authorEl = authorElementName(schema, item.name);
  const basics = itemPart(item, 'DADOS-BASICOS');
  const detail = itemPart(item, 'DETALHAMENTO');
  const partOf = (p: 'DADOS-BASICOS' | 'DETALHAMENTO') => (p === 'DADOS-BASICOS' ? basics : detail);

  const problems = useMemo(() => {
    const fromSchema = validateItem(schema, item);
    const fromForm = spec
      ? missingRequired(spec, partOf).map((m) => ({
          attribute: m.attr,
          element: m.element,
          message: `${attributeLabel(m.attr)}: obrigatório`,
        }))
      : [];
    // O formulário e a validação geral podem apontar o mesmo campo.
    const seen = new Set<string>();
    return [...fromSchema, ...fromForm].filter((p) => {
      const key = `${p.element}/${p.attribute ?? p.message}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item, version]);

  const errorFor = (el: XElement | undefined, attr: string) =>
    attempted && el
      ? problems.find((p) => p.element === el.name && p.attribute === attr)?.message.split(': ')[1]
      : undefined;

  const listed = new Set(spec?.fieldsets.flatMap((s) => s.fields.map((f) => f.attr)));
  const title = spec?.title ?? elementLabel(item.name);

  // Primeiro clique com pendências mostra os erros nos campos; o segundo salva
  // assim mesmo (o item fica marcado e a exportação espera a correção).
  const save = () => {
    if (problems.length > 0 && !attempted) {
      setAttempted(true);
      return;
    }
    onSave(item);
  };

  return (
    <Modal open className="form-modal" focusFirstField={isNew} label={title} onClose={onCancel}>
      <form
        className="production-form"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <header className="form-head">
          <h2>{isNew ? `Novo: ${title}` : title}</h2>
          <span className="muted seq" title="SEQUENCIA-PRODUCAO">
            nº {sequencia}
          </span>
        </header>

        <div className="form-body">
          {DOI_TYPES.has(item.name) && (
            <DoiLookup
              hint="Preenche título, ano, autores, periódico ou evento e páginas. Confira antes de salvar."
              onFound={(work) => {
                const filled = applyCrossref(item, work);
                const fromDoi = crossrefAuthors(work, knownAuthors);
                if (authorEl && fromDoi.length > 0) setAuthors(schema, item, fromDoi);
                touch();
                const other = itemNameFor(work);
                const mismatch =
                  other && other !== item.name
                    ? ` Esse DOI é de outro tipo (${elementLabel(other)}); confira os campos.`
                    : '';
                return `Preenchidos ${filled.length} campos e ${fromDoi.length} autores. Confira antes de salvar.${mismatch}`;
              }}
            />
          )}
          {spec
            ? spec.fieldsets.map((set) => {
                const part = partOf(set.part);
                if (!part) return null;
                const attrSpecs = schema.elements[part.name]?.attributes ?? [];
                return (
                  <fieldset key={set.legend} className="form-fieldset">
                    <legend>{set.legend}</legend>
                    <div className="fields">
                      {set.fields.map((field) => (
                        <AttributeField
                          key={field.attr}
                          el={part}
                          error={errorFor(part, field.attr)}
                          multiline={field.multiline}
                          name={field.attr}
                          required={field.required}
                          spec={attrSpecs.find((a) => a.name === field.attr)}
                          wide={field.wide}
                          onEdit={touch}
                        />
                      ))}
                    </div>
                  </fieldset>
                );
              })
            : // Sem formulário desenhado: todos os campos das partes do item.
              [basics, detail].map(
                (part) =>
                  part && (
                    <fieldset key={part.name} className="form-fieldset">
                      <legend>{elementLabel(part.name)}</legend>
                      <Attributes showEmpty el={part} onEdit={touch} />
                    </fieldset>
                  ),
              )}

          {authorEl && (
            <AuthorsEditor
              authors={readAuthors(item)}
              known={knownAuthors}
              label={authorEl === 'AUTORES' ? 'Autores' : 'Participantes'}
              onChange={(next) => {
                setAuthors(schema, item, next);
                touch();
              }}
            />
          )}

          <KeywordsField
            words={readKeywords(item)}
            onChange={(words) => {
              setKeywords(schema, item, words);
              touch();
            }}
          />

          {spec && (
            <details
              className="form-more"
              open={showAll}
              onToggle={(e) => setShowAll((e.target as HTMLDetailsElement).open)}
            >
              <summary>Mais campos</summary>
              {showAll &&
                [basics, detail].map((part) => {
                  if (!part) return null;
                  const attrSpecs = schema.elements[part.name]?.attributes ?? [];
                  const rest = part.attrs.filter((a) => !listed.has(a.name));
                  if (rest.length === 0) return null;
                  return (
                    <div key={part.name} className="fields">
                      {rest.map((a) => (
                        <AttributeField
                          key={a.name}
                          el={part}
                          error={errorFor(part, a.name)}
                          name={a.name}
                          spec={attrSpecs.find((s) => s.name === a.name)}
                          onEdit={touch}
                        />
                      ))}
                    </div>
                  );
                })}
            </details>
          )}
        </div>

        <footer className="form-foot">
          {problems.length > 0 ? (
            <details className="form-problems">
              <summary>
                {problems.length === 1 ? '1 pendência' : `${problems.length} pendências`} para
                importar no Lattes
              </summary>
              <ul>
                {problems.map((p, i) => (
                  <li key={i}>{p.message}</li>
                ))}
              </ul>
            </details>
          ) : (
            <span className="form-ok">Pronto para importar</span>
          )}
          <span className="form-actions">
            {onRemove && (
              <button className="ghost danger" type="button" onClick={onRemove}>
                Remover item
              </button>
            )}
            <button className="ghost" type="button" onClick={onCancel}>
              Cancelar
            </button>
            <button className="primary" type="submit">
              {attempted && problems.length > 0 ? 'Salvar com pendências' : 'Salvar'}
            </button>
          </span>
        </footer>
      </form>
    </Modal>
  );
}

function KeywordsField({ onChange, words }: { words: string[]; onChange: (w: string[]) => void }) {
  const [draft, setDraft] = useState(words.join(', '));
  return (
    <fieldset className="form-fieldset">
      <legend>Palavras-chave</legend>
      <div className="field field-wide">
        <label htmlFor="palavras-chave">Até 6, separadas por vírgula</label>
        <input
          id="palavras-chave"
          value={draft}
          onBlur={() => onChange(draft.split(','))}
          onChange={(e) => setDraft(e.target.value)}
        />
      </div>
    </fieldset>
  );
}
