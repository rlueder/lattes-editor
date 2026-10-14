// Formulário de item novo fora da produção: formação acadêmica (um nível por
// vez), atuação profissional com o primeiro vínculo, projeto e patente. Segue
// o "Novo item" de produção (ProductionForm): trabalha sobre uma cópia e nada
// entra no documento até "Salvar". O Importar não leva estas seções; o item
// vai ao Lattes pela lista "Enviar ao Lattes" (conector ou à mão).

import { useEffect, useId, useMemo, useRef, useState } from 'react';

import { attributeLabel } from '../labels/labels.ts';
import { type AtuacaoChoice, type GeneralType, readTeam, setTeam } from '../model/general-items.ts';
import { type Author, readAuthors, setAuthors } from '../model/production.ts';
import { type Problem, validateItem } from '../model/validate.ts';
import type { XElement } from '../model/xml.ts';
import { lattesSchema as schema } from '../schema/lattes.ts';
import { AttributeField } from '../ui/AttributeField.tsx';
import { DiscardConfirm } from '../ui/dialogs.tsx';
import { ChevronIcon, CloseIcon, CollapseIcon, ExpandIcon } from '../ui/icons.tsx';
import { isRedundantDateFormat } from '../ui/lattes-date.ts';
import { Modal } from '../ui/Modal.tsx';
import { Select } from '../ui/primitives/Select.tsx';
import { Tip } from '../ui/primitives/Tip.tsx';
import { AuthorsEditor } from './AuthorsEditor.tsx';
import { generalParts, missingGeneral } from './general-specs.ts';
import { useDiscardGuard } from './use-discard-guard.ts';

interface Props {
  /** Projeto: as atuações onde ele pode entrar. */
  atuacoes: AtuacaoChoice[];
  item: XElement;
  knownAuthors: Author[];
  /** Onde o tipo mora no menu, para a trilha do cabeçalho ("Formação"). */
  sectionLabel: string;
  type: GeneralType;
  onCancel: () => void;
  onSave: (item: XElement, atuacaoKey?: string) => void;
}

const isHeadline = (attr: string) => attr.startsWith('TITULO') || attr === 'NOME-DO-PROJETO';

export function GeneralItemForm({
  atuacoes,
  item,
  knownAuthors,
  onCancel,
  onSave,
  sectionLabel,
  type,
}: Props) {
  const [version, setVersion] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [atuacao, setAtuacao] = useState(() => (atuacoes.length === 1 ? atuacoes[0]!.key : ''));
  const formRef = useRef<HTMLFormElement>(null);
  const atuacaoId = useId();
  const touch = () => setVersion((v) => v + 1);
  const { confirm, requestClose } = useDiscardGuard(item, onCancel);

  // ⌘Enter (Ctrl+Enter fora do Mac) salva, como no formulário de produção.
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

  const parts = generalParts(schema, type.kind, item);
  const isProject = type.kind === 'projeto';
  const noAtuacao = isProject && atuacoes.length === 0;

  const problems = useMemo(() => {
    const fromSchema = validateItem(schema, item);
    const fromForm = missingGeneral(parts).map((m) => ({
      attribute: m.attr,
      element: m.element,
      message: `${attributeLabel(m.attr)}: obrigatório`,
    }));
    const fromPlace: Problem[] =
      isProject && !atuacao
        ? [{ element: item.name, message: 'Escolha a atuação onde o projeto entra' }]
        : [];
    const seen = new Set<string>();
    return [...fromPlace, ...fromSchema, ...fromForm].filter((p) => {
      const key = `${p.element}/${p.attribute ?? p.message}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    // O item é mutado no lugar; `version` avisa a mudança.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item, version, atuacao]);

  const errorFor = (el: XElement, attr: string) =>
    attempted
      ? problems.find((p) => p.element === el.name && p.attribute === attr)?.message.split(': ')[1]
      : undefined;

  const first = parts[0];
  const headline =
    first?.fields[0] && isHeadline(first.fields[0].attr) ? first.fields[0] : undefined;
  // Campos já mostrados, por elemento: as partes da formação editam todas o próprio item.
  const listed = new Map<XElement, Set<string>>();
  for (const p of parts) {
    const names = listed.get(p.el) ?? new Set<string>();
    for (const field of p.fields) names.add(field.attr);
    listed.set(p.el, names);
  }

  // Como no formulário de produção: o primeiro clique com pendências mostra os
  // erros nos campos, o segundo salva assim mesmo (a lista de envio mostra o que falta).
  const save = () => {
    if (noAtuacao) return;
    if (problems.length > 0 && !attempted) {
      setAttempted(true);
      return;
    }
    if (isProject && !atuacao) return;
    onSave(item, isProject ? atuacao : undefined);
  };

  const people =
    type.kind === 'patente'
      ? { label: 'Autores', list: readAuthors(item) }
      : isProject
        ? { label: 'Equipe', list: readTeam(item) }
        : undefined;

  return (
    <Modal
      bare
      focusFirstField
      open
      className={`form-modal${expanded ? ' expanded' : ''}`}
      label={type.label}
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
            <span className="crumb">{sectionLabel}</span>
            <ChevronIcon />
            <h2 className="crumb-current">{type.label}</h2>
          </nav>
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
          {headline && first && (
            <AttributeField
              prominent
              el={first.el}
              error={errorFor(first.el, headline.attr)}
              name={headline.attr}
              required={headline.required}
              spec={schema.elements[first.el.name]?.attributes.find(
                (a) => a.name === headline.attr,
              )}
              onEdit={touch}
            />
          )}

          {isProject && (
            <fieldset className="form-fieldset">
              <legend>Atuação</legend>
              {noAtuacao ? (
                <p className="muted">
                  O projeto fica dentro de uma atuação profissional, e este currículo ainda não tem
                  nenhuma. Crie a atuação antes, em Atuação.
                </p>
              ) : (
                <div className="field field-wide">
                  <label htmlFor={atuacaoId}>Instituição da atuação</label>
                  <Select
                    aria-invalid={attempted && !atuacao ? true : undefined}
                    id={atuacaoId}
                    options={atuacoes.map((a) => ({ label: a.label, value: a.key }))}
                    placeholder="Escolha a atuação"
                    value={atuacao}
                    onChange={setAtuacao}
                  />
                  {attempted && !atuacao && (
                    <span className="field-error">Escolha a atuação onde o projeto entra</span>
                  )}
                </div>
              )}
            </fieldset>
          )}

          {parts.map((part) => {
            const attrSpecs = schema.elements[part.el.name]?.attributes ?? [];
            const fields = part.fields.filter((field) => !(part === first && field === headline));
            if (fields.length === 0) return null;
            return (
              <fieldset key={part.legend} className="form-fieldset">
                <legend>{part.legend}</legend>
                <div className="fields">
                  {fields.map((field) => (
                    <AttributeField
                      key={field.attr}
                      el={part.el}
                      error={errorFor(part.el, field.attr)}
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
          })}

          {people && (
            <AuthorsEditor
              authors={people.list}
              known={knownAuthors}
              label={people.label}
              onChange={(next) => {
                if (isProject) setTeam(schema, item, next);
                else setAuthors(schema, item, next);
                touch();
              }}
            />
          )}

          <details
            className="form-more"
            open={showAll}
            onToggle={(e) => setShowAll((e.target as HTMLDetailsElement).open)}
          >
            <summary>Mais campos</summary>
            {showAll &&
              [...listed].map(([el, names]) => {
                const attrSpecs = schema.elements[el.name]?.attributes ?? [];
                const rest = el.attrs.filter(
                  (a) => !names.has(a.name) && !isRedundantDateFormat(a.name, a.value),
                );
                if (rest.length === 0) return null;
                return (
                  <div key={el.name} className="fields">
                    {rest.map((a) => (
                      <AttributeField
                        key={a.name}
                        el={el}
                        error={errorFor(el, a.name)}
                        name={a.name}
                        spec={attrSpecs.find((s) => s.name === a.name)}
                        onEdit={touch}
                      />
                    ))}
                  </div>
                );
              })}
          </details>
        </div>

        <footer className="modal-foot form-foot">
          {problems.length > 0 ? (
            <details className="form-problems">
              <summary>
                {problems.length === 1 ? '1 pendência' : `${problems.length} pendências`} para
                enviar ao Lattes
              </summary>
              <ul>
                {problems.map((p, i) => (
                  <li key={i}>{p.message}</li>
                ))}
              </ul>
            </details>
          ) : (
            <span className="form-ok">
              Pronto. Vai ao Lattes pela lista de alterações, não pelo Importar.
            </span>
          )}
          <span className="form-actions">
            <Tip label="⌘Enter">
              <button className="primary" disabled={noAtuacao} type="submit">
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
