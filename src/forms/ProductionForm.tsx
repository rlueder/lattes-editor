// Formulário de um item de produção, novo ou ainda não importado. Trabalha
// sobre uma cópia; nada entra no documento até "Salvar".

import { useEffect, useId, useMemo, useRef, useState } from 'react';

import { attributeLabel, elementLabel } from '../labels/labels.ts';
import { applyCrossref, crossrefAuthors, itemNameFor } from '../lookups/crossref.ts';
import { DoiLookup } from '../lookups/DoiLookup.tsx';
import {
  type Author,
  authorElementName,
  itemPart,
  type KnowledgeArea,
  readAreas,
  readAuthors,
  readKeywords,
  setAreas,
  setAuthors,
  setKeywords,
} from '../model/production.ts';
import { uniqueProblems, validateItem } from '../model/validate.ts';
import type { XElement } from '../model/xml.ts';
import type { Candidate, ProfileCache } from '../review/dedup.ts';
import { lattesSchema as schema } from '../schema/lattes.ts';
import { AttributeField } from '../ui/AttributeField.tsx';
import { DiscardConfirm } from '../ui/dialogs.tsx';
import { Attributes } from '../ui/ElementView.tsx';
import { ChevronIcon, CloseIcon, CollapseIcon, ExpandIcon } from '../ui/icons.tsx';
import { isRedundantDateFormat } from '../ui/lattes-date.ts';
import { Modal } from '../ui/Modal.tsx';
import { Switch } from '../ui/primitives/Switch.tsx';
import { Tip } from '../ui/primitives/Tip.tsx';
import { useGroupStarts } from '../ui/use-group-starts.ts';
import { AreasEditor } from './AreasEditor.tsx';
import { AuthorsEditor } from './AuthorsEditor.tsx';
import { DuplicateNotice } from './DuplicateNotice.tsx';
import { sectionFacts } from './form-sections.ts';
import { FormSection } from './FormSection.tsx';
import { formSpec, missingRequired } from './specs.ts';
import { useDiscardGuard } from './use-discard-guard.ts';

/** Tipos que o mapeamento do Crossref sabe preencher. */
const DOI_TYPES = new Set([
  'ARTIGO-PUBLICADO',
  'TRABALHO-EM-EVENTOS',
  'CAPITULO-DE-LIVRO-PUBLICADO',
  'LIVRO-PUBLICADO-OU-ORGANIZADO',
]);

interface Props {
  /** O item vai por "Enviar ao Lattes" (inclusão pelo conector), e não pelo Importar. */
  byChanges?: boolean;
  /**
   * O item do currículo com que este se parece (LAT-45), para um item novo
   * não virar duplicata sem a pessoa saber; ela decide se salva.
   */
  duplicateOf?: (item: XElement, cache: ProfileCache) => Candidate | undefined;
  isNew: boolean;
  item: XElement;
  knownAreas: KnowledgeArea[];
  knownAuthors: Author[];
  /** Número que o item vai receber (novo) ou tem (existente). */
  sequencia: number;
  onCancel: () => void;
  onRemove?: () => void;
  onSave: (item: XElement, another?: boolean) => void;
}

/** O rodapé: o evento incluído pelo conector vai por "Enviar ao Lattes", não pelo Importar. */
const footText = (byChanges: boolean) =>
  byChanges
    ? { problems: 'para enviar ao Lattes', ready: 'Pronto para enviar ao Lattes' }
    : { problems: 'para importar no Lattes', ready: 'Pronto para importar' };

export function ProductionForm({
  byChanges = false,
  duplicateOf,
  isNew,
  item,
  knownAreas,
  knownAuthors,
  onCancel,
  onRemove,
  onSave,
  sequencia,
}: Props) {
  const [version, setVersion] = useState(0);
  const foot = footText(byChanges);
  const [expanded, setExpanded] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const createMoreId = useId();

  // ⌘Enter (Ctrl+Enter fora do Mac) salva de qualquer campo, como no Linear.
  // O blur antes grava o campo em edição.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || !(e.metaKey || e.ctrlKey)) return;
      const form = formRef.current;
      if (!form) return;
      e.preventDefault();
      (document.activeElement as HTMLElement | null)?.blur();
      setTimeout(() => form.requestSubmit(), 0);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  const [createMore, setCreateMore] = useState(() => isNew && readCreateMore());
  const [showAll, setShowAll] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const touch = () => setVersion((v) => v + 1);
  const { confirm, requestClose } = useDiscardGuard(item, onCancel);

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
    return uniqueProblems([...fromSchema, ...fromForm]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item, version]);

  const errorFor = (el: XElement | undefined, attr: string) =>
    attempted && el
      ? problems.find((p) => p.element === el.name && p.attribute === attr)?.message.split(': ')[1]
      : undefined;

  const listed = new Set(spec?.fieldsets.flatMap((s) => s.fields.map((f) => f.attr)));
  const title = spec?.title ?? elementLabel(item.name);
  // O primeiro campo do formulário, quando é o título, vira o cabeçalho do item.
  const firstSet = spec?.fieldsets[0];
  const headline = firstSet?.fields[0]?.attr.startsWith('TITULO') ? firstSet.fields[0] : undefined;
  const headlinePart = firstSet && partOf(firstSet.part);

  // Partes longas fecham numa linha (disclosure.ts): a primeira e as com
  // obrigatório abertas; um erro do primeiro "Salvar" abre a sua.
  const sections = (spec?.fieldsets ?? []).flatMap((set) => {
    const part = partOf(set.part);
    if (!part) return [];
    const fields = set.fields.filter((field) => field !== headline);
    // A parte que fica só com o título (que vai para o topo) não aparece nem conta.
    if (fields.length === 0) return [];
    const facts = sectionFacts(set.legend, part, fields, (attr) => !!errorFor(part, attr));
    return [{ facts, fields, part, set }];
  });
  const startOf = useGroupStarts(
    sections.map((s) => s.facts),
    { editing: !isNew, fields: sections.reduce((n, s) => n + s.fields.length, 0) },
  );

  // Primeiro clique com pendências mostra os erros nos campos; o segundo salva
  // assim mesmo (o item fica marcado e a exportação espera a correção).
  const save = () => {
    if (problems.length > 0 && !attempted) {
      setAttempted(true);
      return;
    }
    onSave(item, isNew && createMore);
  };

  return (
    <Modal
      bare
      open
      className={`form-modal${expanded ? ' expanded' : ''}`}
      focusFirstField={isNew}
      label={title}
      onClose={requestClose}
    >
      <form
        ref={formRef}
        className="production-form"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <header className="modal-head modal-crumbs">
          <nav aria-label="Onde este item fica" className="crumbs">
            <span className="crumb">{isNew ? 'Novo item' : 'Item a enviar'}</span>
            <ChevronIcon />
            <h2 className="crumb-current">{title}</h2>
          </nav>
          <span className="seq muted" title="SEQUENCIA-PRODUCAO">
            nº {sequencia}
          </span>
          <Tip label={expanded ? 'Reduzir' : 'Expandir'}>
            <button
              aria-label={expanded ? 'Reduzir' : 'Expandir'}
              className="ghost icon-btn modal-close"
              type="button"
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded ? <CollapseIcon /> : <ExpandIcon />}
            </button>
          </Tip>
          <button
            aria-label="Fechar"
            className="ghost icon-btn modal-close"
            type="button"
            onClick={requestClose}
          >
            <CloseIcon />
          </button>
        </header>

        <div className="modal-body">
          {headline && headlinePart && (
            <AttributeField
              prominent
              el={headlinePart}
              error={errorFor(headlinePart, headline.attr)}
              name={headline.attr}
              required={headline.required}
              spec={schema.elements[headlinePart.name]?.attributes.find(
                (a) => a.name === headline.attr,
              )}
              onEdit={touch}
            />
          )}
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
            ? sections.map(({ facts, fields, part, set }) => {
                const attrSpecs = schema.elements[part.name]?.attributes ?? [];
                return (
                  <FormSection key={set.legend} facts={facts} start={startOf(set.legend)}>
                    <div className="fields">
                      {fields.map((field) => (
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
                  </FormSection>
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

          {schema.elements[item.name]?.children.some((c) => c.name === 'AREAS-DO-CONHECIMENTO') && (
            <AreasEditor
              areas={readAreas(item)}
              known={knownAreas}
              onChange={(next) => {
                setAreas(schema, item, next);
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
                  const rest = part.attrs.filter(
                    (a) => !listed.has(a.name) && !isRedundantDateFormat(a.name, a.value),
                  );
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

        <DuplicateNotice find={isNew ? duplicateOf : undefined} item={item} version={version} />
        <footer className="modal-foot form-foot">
          {problems.length > 0 ? (
            <details className="form-problems">
              <summary>
                {problems.length === 1 ? '1 pendência' : `${problems.length} pendências`}{' '}
                {foot.problems}
              </summary>
              <ul>
                {problems.map((p, i) => (
                  <li key={i}>{p.message}</li>
                ))}
              </ul>
            </details>
          ) : (
            <span className="form-ok">{foot.ready}</span>
          )}
          <span className="form-actions">
            {isNew && (
              <span className="create-more">
                <Switch
                  aria-labelledby={createMoreId}
                  checked={createMore}
                  onChange={(on) => {
                    setCreateMore(on);
                    writeCreateMore(on);
                  }}
                />
                <span id={createMoreId}>Criar outro</span>
              </span>
            )}
            {onRemove && (
              <button className="ghost danger" type="button" onClick={onRemove}>
                Remover item
              </button>
            )}
            <Tip label="⌘Enter">
              <button className="primary" type="submit">
                {attempted && problems.length > 0 ? 'Salvar com pendências' : 'Salvar'}
              </button>
            </Tip>
          </span>
        </footer>
      </form>
      <DiscardConfirm {...confirm} />
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

// "Criar outro" fica lembrado neste navegador; sem armazenamento, começa desligado.
const CREATE_MORE_KEY = 'lattes-editor:criar-outro';

function readCreateMore(): boolean {
  try {
    return localStorage.getItem(CREATE_MORE_KEY) === '1';
  } catch {
    return false;
  }
}

function writeCreateMore(on: boolean) {
  try {
    localStorage.setItem(CREATE_MORE_KEY, on ? '1' : '0');
  } catch {
    // Sem armazenamento: vale só nesta abertura.
  }
}
