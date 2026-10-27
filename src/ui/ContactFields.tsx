// Os endereços de contatos existentes. O modelo preserva os identificadores
// e os separadores do atributo; incluir ou tirar registros fica no Lattes.

import { useEffect, useId, useState } from 'react';

import {
  type ContactField,
  contactValueProblem,
  editableContacts,
  replaceContactValue,
} from '../model/contact-edit.ts';
import { parseEmails, parseSocial } from '../model/contacts.ts';

interface Props {
  attr: string;
  label: string;
  raw: string;
  onCommit: (value: string) => void;
}

export function ContactFields({ attr, label, onCommit, raw }: Props) {
  const fields = editableContacts(attr, raw);
  if (!fields) return <ContactDisplay attr={attr} label={label} raw={raw} />;
  return (
    <div className="field">
      <span className="field-label">{label}</span>
      <ul className="contact-list">
        {fields.map((field, index) => (
          <li key={index}>
            <ContactInput
              field={field}
              onCommit={(value) => {
                const next = replaceContactValue(raw, attr, index, value);
                if (next !== undefined) onCommit(next);
              }}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

function ContactDisplay({ attr, label, raw }: Pick<Props, 'attr' | 'label' | 'raw'>) {
  const emails = attr === 'ELETRONICO' ? parseEmails(raw) : [];
  const social = attr === 'REDE-SOCIAL' ? parseSocial(raw) : [];
  return (
    <div
      className="field field-readonly"
      title="Inclua ou remova contatos no Lattes; formatos desconhecidos não são reescritos"
    >
      <span className="field-label">{label}</span>
      {emails.length === 0 && social.length === 0 && (
        <span className="readonly-value">{raw || '(vazio)'}</span>
      )}
      <ul className="contact-list">
        {emails.map((contact) => (
          <li key={contact.email}>
            <span className="field-copy-row">
              <span className="contact-value">{contact.email}</span>
              {contact.address && <span className="muted contact-kind">{contact.address}</span>}
            </span>
          </li>
        ))}
        {social.map((contact) => (
          <li key={contact.url}>
            <span className="field-copy-row">
              <a className="contact-value" href={contact.url} rel="noreferrer" target="_blank">
                {contact.url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}
              </a>
              <span className="muted contact-kind">{contact.name}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ContactInput({
  field,
  onCommit,
}: {
  field: ContactField;
  onCommit: (value: string) => void;
}) {
  const id = useId();
  const [draft, setDraft] = useState(field.value);
  const [error, setError] = useState<string>();
  useEffect(() => {
    setDraft(field.value);
    setError(undefined);
  }, [field.value]);
  return (
    <div className="field">
      <label htmlFor={id}>{field.label}</label>
      <input
        aria-describedby={error ? `${id}-error` : undefined}
        aria-invalid={error ? true : undefined}
        autoComplete="off"
        id={id}
        type={field.kind === 'email' ? 'email' : field.kind === 'url' ? 'url' : 'text'}
        value={draft}
        onBlur={() => {
          const problem = contactValueProblem(field.kind, draft.trim());
          setError(problem);
          if (!problem) {
            setDraft(draft.trim());
            onCommit(draft);
          }
        }}
        onChange={(event) => {
          setDraft(event.target.value);
          setError(undefined);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            event.currentTarget.blur();
          }
          if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            setDraft(field.value);
            setError(undefined);
          }
        }}
      />
      {error && (
        <span className="field-error" id={`${id}-error`}>
          {error}
        </span>
      )}
    </div>
  );
}
