// Campo de um atributo: texto, área de texto, data, ano ou lista de opções (enum).
// Grava no elemento ao sair do campo; usado na visão genérica e nos formulários.

import { type ReactNode, useEffect, useId, useState } from 'react';

import { attributeLabelIn, elementLabel, enumLabel } from '../labels/labels.ts';
import { repairMojibake } from '../model/mojibake.ts';
import { getAttr, setAttr, type XElement } from '../model/xml.ts';
import {
  canonicalChoice,
  emptyChoicesHint,
  matchesDerived,
  typedChoices,
} from '../schema/typed-choices.ts';
import type { AttributeSpec } from '../schema/types.ts';
import { parseEmails, parseSocial } from './contacts.ts';
import { CopyButton } from './CopyButton.tsx';
import { DateField } from './DateField.tsx';
import { useDraft, usePartKey } from './draft-context.ts';
import {
  codeAttrFor,
  codeChoices,
  codeValueLabel,
  flagAsShown,
  flagToXml,
  isBooleanAttr,
  isSystemAttr,
} from './field-kind.ts';
import { LockIcon } from './icons.tsx';
import { displayLattesDate, isLattesDateAttr, isValidLattesDate } from './lattes-date.ts';
import { useLattesListsContext } from './lattes-lists-context.ts';
import { isFourDigitYear, isLattesYearAttr } from './lattes-year.ts';
import { cleanLinkValue, linkError } from './link-fields.ts';
import { liveKind } from './live-lists.ts';
import { LiveListControl } from './LiveListField.tsx';
import { ComboSelect } from './primitives/ComboSelect.tsx';
import { Switch } from './primitives/Switch.tsx';
import { Tip } from './primitives/Tip.tsx';
import { isSensitiveAttr, useHideSensitive } from './privacy.ts';
import { YearField } from './YearField.tsx';

export type EditFn = (note: string) => void;

interface Props {
  /** Mostra o botão "copiar" do valor, para colar no formulário do Lattes. */
  copyable?: boolean;
  el: XElement;
  /** Mensagem de validação mostrada sob o campo. */
  error?: string;
  /** Rótulo no lugar do gerado a partir do nome XML. */
  label?: string;
  /** Texto longo: força área de texto. */
  multiline?: boolean;
  name: string;
  /** Título do item: campo grande e sem borda no topo do formulário, rótulo só para leitores de tela. */
  prominent?: boolean;
  /** Marca de obrigatório além da que o schema já declara. */
  required?: boolean;
  spec?: AttributeSpec;
  wide?: boolean;
  onEdit: EditFn;
}

export function AttributeField({
  copyable,
  el,
  error,
  label,
  multiline,
  name,
  onEdit,
  prominent,
  required,
  spec,
  wide,
}: Props) {
  const hideSensitive = useHideSensitive();
  const lists = useLattesListsContext();
  // Prévia do modo de leitura: acompanha o texto antes de gravar.
  const onDraft = useDraft();
  const partKey = usePartKey()?.(el, name);
  const value = getAttr(el, name) ?? '';
  const [draft, setDraft] = useState(value);
  // Valor mudou por fora (busca por DOI, restauração do histórico).
  useEffect(() => setDraft(value), [value]);
  const text = label ?? attributeLabelIn(el.name, name);
  // Só sugere; o valor fica como veio até a pessoa clicar em "Corrigir".
  const repaired = repairMojibake(value);
  const change = (next: string) => {
    setDraft(next);
    onDraft?.(el, name, next);
  };
  const commit = (next: string) => {
    onDraft?.(el, name, next);
    if (next === (getAttr(el, name) ?? '')) return;
    setAttr(el, name, next);
    onEdit(`${elementLabel(el.name)} · ${text}`);
  };
  const shownError = error ?? linkError(name, value);
  const id = useId();
  const errorId = `${id}-erro`;
  const labelId = `${id}-rotulo`;
  const common = {
    'aria-describedby': shownError ? errorId : undefined,
    'aria-invalid': shownError ? true : undefined,
    id,
  };

  if (hideSensitive && isSensitiveAttr(el.name, name)) {
    // Modo de privacidade: o valor some da tela (e do DOM); só se sabe se está preenchido.
    return (
      <div className="field field-readonly field-hidden">
        <span className="field-label">{text}</span>
        <span className="readonly-value">{value ? '••••••' : '(vazio)'}</span>
      </div>
    );
  }

  if (el.name === 'ENDERECO' && (name === 'ELETRONICO' || name === 'REDE-SOCIAL') && value) {
    // Serializado pelo Lattes num texto só: mostrado lido, editado no próprio Lattes.
    const emails = name === 'ELETRONICO' ? parseEmails(value) : [];
    const social = name === 'REDE-SOCIAL' ? parseSocial(value) : [];
    if (emails.length > 0 || social.length > 0) {
      return (
        <div className="field field-readonly" title="Vem da exportação; edite no Lattes">
          <span className="field-label">{text}</span>
          <ul className="contact-list">
            {emails.map((c) => (
              <li key={c.email}>
                <span className="field-copy-row">
                  <span className="contact-value">{c.email}</span>
                  {c.address && <span className="muted contact-kind">{c.address}</span>}
                  <CopyButton label={text} value={c.email} />
                </span>
              </li>
            ))}
            {social.map((c) => (
              <li key={c.url}>
                <span className="field-copy-row">
                  <a className="contact-value" href={c.url} rel="noreferrer" target="_blank">
                    {c.url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}
                  </a>
                  <span className="muted contact-kind">{c.name}</span>
                  <CopyButton label={c.name} value={c.url} />
                </span>
              </li>
            ))}
          </ul>
        </div>
      );
    }
  }

  // Listas lidas no Lattes pelo conector (LAT-48): sem elas, o campo de sempre.
  const live = liveKind(el, name, lists);
  if (live === 'area-derivada') {
    return (
      <div className="field field-readonly field-locked">
        <ReadonlyLabel text={text} why="Segue a área do conhecimento escolhida" />
        <span className="locked-value">{value ? enumLabelOrValue(name, value) : '(vazio)'}</span>
      </div>
    );
  }
  if (live) {
    return wrap(
      <LiveListControl
        common={common}
        el={el}
        kind={live}
        lists={lists}
        onChanged={() => onEdit(`${elementLabel(el.name)} · ${text}`)}
      />,
      { copy: copyable },
    );
  }

  const lockedBy = codeAttrFor(el.name, name);
  if (lockedBy && getAttr(el, lockedBy)) {
    // Escolhido numa lista do Lattes junto com o código ao lado: lido, não editado.
    return (
      <div className="field field-readonly field-locked">
        <ReadonlyLabel text={text} why="Escolhido numa lista do Lattes; muda junto com o código" />
        <span className="field-copy-row">
          <span className="locked-value">{value || '(vazio)'}</span>
          {copyable && <CopyButton label={text} value={value} />}
        </span>
      </div>
    );
  }

  if (matchesDerived(el, name)) {
    // Segue outra escolha (a natureza segue o tipo de evento): lido, não editado.
    return (
      <div className="field field-readonly field-locked">
        <ReadonlyLabel text={text} why="Segue o tipo de item escolhido" />
        <span className="locked-value">{value}</span>
      </div>
    );
  }

  const dateAttr = isLattesDateAttr(
    el.name,
    name,
    el.attrs.map((a) => a.name),
  );

  if (isSystemAttr(el.name, name)) {
    // Código ou sequência gerado pelo Lattes: texto, não campo.
    return (
      <div className="field field-readonly">
        <ReadonlyLabel text={text} why="Gerado pelo Lattes; não se edita aqui" />
        <span className="field-copy-row">
          <span className="readonly-value">
            {value
              ? dateAttr
                ? displayLattesDate(value)
                : codeValueLabel(el.name, name, value)
              : '(vazio)'}
          </span>
          {copyable && <CopyButton label={text} value={value} />}
        </span>
      </div>
    );
  }

  const boolean = isBooleanAttr(name, spec, value);
  // No sentido da tela do Lattes (marcas que a exportação grava ao contrário).
  const shownFlag = flagAsShown(el.name, name, value);
  // Lista do Lattes: códigos conhecidos (field-kind) ou campos tipados (LAT-48).
  const choices = codeChoices(el.name, name) ?? typedChoices(el, name);
  // Data em DDMMAAAA vira campo de data; valor que não é data válida fica texto, intacto.
  const date = dateAttr && (value === '' || isValidLattesDate(value));
  // Ano em AAAA vira campo de ano; valor que não tem quatro dígitos fica texto, intacto.
  const year = isLattesYearAttr(el.name, name) && (value === '' || isFourDigitYear(value));
  // Texto longo vira área de texto e ocupa a linha inteira, empilhado.
  const textarea =
    !boolean &&
    !spec?.enum &&
    !choices &&
    !date &&
    !year &&
    !prominent &&
    (multiline || value.length > 90);
  let control;
  if (boolean) {
    control = (
      <span className="switch-row">
        <Switch
          aria-describedby={common['aria-describedby']}
          aria-labelledby={labelId}
          checked={shownFlag === 'SIM'}
          id={id}
          onChange={(on) => commit(flagToXml(el.name, name, on ? 'SIM' : 'NAO'))}
        />
        <span aria-hidden="true" className="switch-text">
          {shownFlag === 'SIM' ? 'Sim' : shownFlag === 'NAO' ? 'Não' : 'Não informado'}
        </span>
      </span>
    );
  } else if (choices) {
    // Lista do Lattes. Valor fora dela continua visível (e aparece como pendência);
    // o que só difere em acento ou maiúscula aparece como está salvo, ao lado da
    // opção certa, que é a que grava o texto da lista.
    const known = choices.some((c) => c.value === value) || value === '';
    const canonical = canonicalChoice(el, name);
    const hint = choices.length === 0 ? emptyChoicesHint(el, name) : undefined;
    control = (
      <ComboSelect
        {...common}
        disabled={choices.length === 0 && known}
        options={[
          { label: hint ?? '(escolha)', value: '' },
          ...(known ? [] : [{ label: canonical ? `${value} (como está salvo)` : value, value }]),
          ...choices,
        ]}
        value={value}
        onChange={commit}
      />
    );
  } else if (spec?.enum) {
    // Valor fora da lista (exportação mais nova que o XSD) continua visível.
    const values = spec.enum.includes(value) || value === '' ? spec.enum : [value, ...spec.enum];
    control = (
      <ComboSelect
        {...common}
        options={[
          { label: '(escolha)', value: '' },
          ...values.map((v) => ({ label: enumLabel(v), value: v })),
        ]}
        value={value}
        onChange={commit}
      />
    );
  } else if (date) {
    control = <DateField common={common} label={text} value={value} onCommit={commit} />;
  } else if (year) {
    control = <YearField common={common} label={text} value={value} onCommit={commit} />;
  } else if (prominent) {
    control = (
      <textarea
        {...common}
        className="title-input"
        placeholder={text}
        rows={1}
        value={draft}
        onBlur={() => commit(cleanLinkValue(name, draft))}
        onChange={(e) => change(e.target.value)}
        onKeyDown={(e) => {
          // Título é uma linha só: Enter confirma em vez de quebrar.
          if (e.key === 'Enter') {
            e.preventDefault();
            (e.target as HTMLTextAreaElement).blur();
          }
        }}
      />
    );
  } else if (textarea) {
    control = (
      <textarea
        {...common}
        rows={multiline ? 3 : 4}
        value={draft}
        onBlur={() => commit(cleanLinkValue(name, draft))}
        onChange={(e) => change(e.target.value)}
      />
    );
  } else {
    control = (
      <input
        {...common}
        type="text"
        value={draft}
        onBlur={() => commit(cleanLinkValue(name, draft))}
        onChange={(e) => change(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      />
    );
  }

  return wrap(control, { copy: copyable && !boolean, textarea });

  /**
   * O campo com rótulo, marca de obrigatório, botão de copiar, correção de
   * texto estragado e erro. Só usa o que já está definido no começo do
   * componente: é chamado também antes do resto (listas do conector).
   */
  function wrap(control: ReactNode, opts: { copy?: boolean; textarea?: boolean } = {}) {
    const { copy = false, textarea = false } = opts;
    return (
      <div
        className={`field${wide || prominent || textarea ? ' field-wide' : ''}${prominent ? ' field-prominent' : ''}${shownError ? ' has-error' : ''}`}
        data-part={partKey}
      >
        <label
          className={prominent ? 'sr-only' : undefined}
          htmlFor={id}
          id={labelId}
          title={spec?.patched ? `${name} (fora do XSD publicado)` : name}
        >
          {text}
          {(spec?.required || required) && (
            <span aria-label="obrigatório" className="required">
              {' '}
              *
            </span>
          )}
        </label>
        {copy ? (
          <span className="field-copy-row">
            {control}
            <CopyButton label={text} value={value} />
          </span>
        ) : (
          control
        )}
        {repaired !== undefined && (
          <span className="field-note">
            Texto estragado no próprio Lattes (acentos ou &quot;aspas&quot;).{' '}
            <button
              className="link-btn"
              title={repaired}
              type="button"
              onClick={() => commit(repaired)}
            >
              Corrigir
            </button>
          </span>
        )}
        {shownError && (
          <span className="field-error" id={errorId}>
            {shownError}
          </span>
        )}
      </div>
    );
  }
}

/** A grande área é um valor do XSD (CIENCIAS_EXATAS_E_DA_TERRA): mostrada por extenso. */
function enumLabelOrValue(attr: string, value: string): string {
  return attr === 'NOME-GRANDE-AREA-DO-CONHECIMENTO' ? enumLabel(value) : value;
}

/**
 * Rótulo de campo só de leitura: o cadeado com a dica do app explica por que
 * não se edita (as duas espécies de campo travado usam o mesmo sinal). O
 * cadeado é um botão sem ação, para a dica valer também no teclado.
 */
function ReadonlyLabel({ text, why }: { text: string; why: string }) {
  return (
    <span className="field-label">
      {text}
      <Tip label={why}>
        <button aria-label={why} className="field-lock" type="button">
          <LockIcon />
        </button>
      </Tip>
    </span>
  );
}
