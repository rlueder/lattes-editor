// Um campo alterado nas listas do "Enviar ao Lattes" (a enviar e enviado):
// o rótulo em cima, como na grade da prévia, e embaixo duas colunas iguais,
// "Antes" (riscado e apagado) e "Depois". Texto longo (resumo, descrição)
// para em quatro linhas, com "mostrar tudo". Valor vazio aparece como
// "(vazio)", sem risco. Em tela estreita, as colunas empilham.

import { type ReactNode, useState } from 'react';

/** Acima disto (ou com quebra de linha), o valor para em quatro linhas e ganha "mostrar tudo". */
const LONG_TEXT = 240;

function isLong(text: string): boolean {
  return text.length > LONG_TEXT || text.includes('\n');
}

/** O valor, com o copiar ao lado; no texto longo, o copiar vai na linha do "mostrar tudo". */
function Value({ extra, text }: { extra?: ReactNode; text: string }) {
  const [open, setOpen] = useState(false);
  if (!text) return <span className="fc-empty">(vazio)</span>;
  if (!isLong(text)) {
    return (
      <>
        <span className="fc-text">{text}</span>
        {extra}
      </>
    );
  }
  return (
    <>
      <span className={`fc-text${open ? '' : ' is-clamped'}`}>{text}</span>
      <span className="fc-foot">
        <button className="fc-more" type="button" onClick={() => setOpen(!open)}>
          {open ? 'mostrar menos' : 'mostrar tudo'}
        </button>
        {extra}
      </span>
    </>
  );
}

export function FieldChange({
  actions,
  after,
  before,
  captions = false,
  copy,
  label,
}: {
  /** Ações do campo (descartar), à mostra no passar do mouse ou com foco. */
  actions?: ReactNode;
  after: string;
  /** Sem `before`, uma coluna só (item novo, ou o valor que sai). */
  before?: string;
  /** "Antes" e "Depois" à vista: no primeiro campo de cada item. */
  captions?: boolean;
  /** Botão de copiar o valor novo. */
  copy?: ReactNode;
  label: string;
}) {
  const two = before !== undefined;
  const caption = (text: string) =>
    captions ? (
      <span className="fc-caption">{text}</span>
    ) : (
      <span className="sr-only">{text}: </span>
    );
  return (
    <div className="fc">
      <div className="fc-label">{label}</div>
      <div className={`fc-cols${two ? '' : ' is-single'}`}>
        {two && (
          <div className="fc-col fc-before">
            {caption('Antes')}
            <Value text={before} />
          </div>
        )}
        <div className="fc-col fc-after">
          {two && caption('Depois')}
          <span className="fc-value">
            <Value extra={copy} text={after} />
          </span>
        </div>
        {actions && <div className="fc-actions">{actions}</div>}
      </div>
    </div>
  );
}
