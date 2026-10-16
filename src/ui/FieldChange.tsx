// Um campo alterado nas listas do "Enviar ao Lattes" (a enviar e enviado),
// como uma célula da grade de campos do item: o rótulo em cima, como na grade
// do modo de leitura, e embaixo o valor. Num campo alterado, o de antes vem
// riscado e apagado, e o de depois logo abaixo dele. Texto longo (resumo,
// descrição) ocupa a linha inteira e para em quatro linhas, com "Ler mais",
// como no modo de leitura. Valor vazio aparece como "(vazio)", sem risco. A grade e o
// empilhamento em tela estreita estão em styles.css (".change-fields").

import { type ReactNode, useState } from 'react';

import { fieldSpan, isLongText } from './change-fields.ts';

function Value({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  if (!text) return <span className="fc-empty">(vazio)</span>;
  if (!isLongText(text)) return <span className="fc-text">{text}</span>;
  return (
    <>
      <span className={`fc-text${open ? '' : ' is-clamped'}`}>{text}</span>
      <button aria-expanded={open} className="fc-more" type="button" onClick={() => setOpen(!open)}>
        {open ? 'Ler menos' : 'Ler mais'}
      </button>
    </>
  );
}

const SPAN_CLASS = { 1: '', 2: ' span-2', 3: ' span-all' } as const;

export function FieldChange({
  actions,
  after,
  before,
  captions = false,
  label,
}: {
  /** Ações do campo (descartar), à mostra no passar do mouse ou com foco. */
  actions?: ReactNode;
  after: string;
  /** Sem `before`, só o valor (item novo, ou o valor que sai). */
  before?: string;
  /** "Antes" e "Depois" à vista: no primeiro campo de cada item. */
  captions?: boolean;
  label: string;
}) {
  const two = before !== undefined;
  const caption = (text: string) =>
    captions ? (
      <span className="fc-caption">{text}</span>
    ) : (
      <span className="sr-only">{text}: </span>
    );
  const span = fieldSpan(two ? [before, after] : [after]);
  return (
    <div className={`fc${two ? ' is-edit' : ''}${SPAN_CLASS[span]}`}>
      <div className="fc-head">
        {/* Rótulo numa linha só; o nome inteiro no passar do mouse. */}
        <span className="fc-label" title={label}>
          {label}
        </span>
        {actions && <span className="fc-actions">{actions}</span>}
      </div>
      {two && (
        <div className="fc-value fc-before">
          {caption('Antes')}
          <Value text={before} />
        </div>
      )}
      <div className="fc-value fc-after">
        {two && caption('Depois')}
        <Value text={after} />
      </div>
    </div>
  );
}
