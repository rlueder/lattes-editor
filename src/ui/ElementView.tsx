// Renderização genérica de qualquer elemento a partir do schema: atributos como
// campos, filhos como blocos recolhíveis. Serve a cauda longa de seções; as
// mais usadas ganham formulários próprios no marco 2.

import { Fragment, useId, useState } from 'react';

import { attributeLabel, elementLabel } from '../labels/labels.ts';
import { childElements, getAttr, type XElement, type XText } from '../model/xml.ts';
import { lattesSchema } from '../schema/lattes.ts';
import { AttributeField, type EditFn } from './AttributeField.tsx';
import type { SectionFilter } from './facets.ts';
import { groupFields, isBooleanAttr, isSystemAttr } from './field-kind.ts';
import { offForm } from './form-order.ts';
import { isListItem } from './item-meta.ts';
import { OUTLINE_HEAD_ATTR, outlineId } from './item-outline.ts';
import { ItemList } from './ItemList.tsx';
import { isRedundantDateFormat } from './lattes-date.ts';
import { useReferenceIndex } from './reference-context.ts';
import { viewForContainer } from './reference-tables.ts';
import { useShowCodes } from './show-codes.ts';

export type { EditFn } from './AttributeField.tsx';

interface ViewProps {
  el: XElement;
  showEmpty: boolean;
  onEdit: EditFn;
}

/** Campos de um ou mais elementos num só bloco, agrupados por assunto. */
function FieldsBlock({
  onEdit,
  showEmpty,
  sources,
}: {
  showEmpty: boolean;
  sources: XElement[];
  onEdit: EditFn;
}) {
  const showCodes = useShowCodes();
  const main = sources[0]!;
  const specs = sources.map(
    (src) => new Map(lattesSchema.elements[src.name]?.attributes.map((a) => [a.name, a])),
  );
  const entries = sources.flatMap((src, i) =>
    src.attrs
      // Números de sequência do Lattes identificam a linha por dentro; não se mostram.
      .filter((a) => !a.name.startsWith('SEQUENCIA-'))
      // O formato da data é sempre DDMMAAAA: o campo de data já diz isso.
      .filter((a) => !isRedundantDateFormat(a.name, a.value))
      .filter((a) => showEmpty || a.value !== '')
      // Fora do formulário do Lattes (form-order.ts): só aparece preenchido.
      .filter((a) => a.value !== '' || !offForm(src.name, a.name))
      // Códigos que o Lattes gera: só com "Mostrar códigos do Lattes" ligado.
      .filter((a) => showCodes || !isSystemAttr(src.name, a.name))
      .map((a) => ({ attr: a.name, element: src.name, key: `${i}:${a.name}`, source: i })),
  );
  const mixed = lattesSchema.elements[main.name]?.mixed;
  const text = main.children.find((c): c is XText => c.kind === 'text' && c.value.trim() !== '');
  if (entries.length === 0 && !mixed) return null;
  const sourceOf = (key: string) => Number(key.slice(0, key.indexOf(':')));
  const valueOf = (e: { attr: string; key: string }) =>
    getAttr(sources[sourceOf(e.key)]!, e.attr) ?? '';
  const groups = groupFields(
    entries,
    attributeLabel,
    (e) => isBooleanAttr(e.attr, specs[sourceOf(e.key)]!.get(e.attr), valueOf(e)),
    // Com os vazios à mostra, eles ficam no fim de cada grupo.
    (e) => valueOf(e).trim() === '',
  );
  // Com poucos campos, os títulos de grupo pesam mais do que ajudam.
  const titled = entries.length >= 6 && groups.length > 1;
  return (
    <div className="fields-block">
      {groups.map((g) => (
        <Fragment key={g.label}>
          {titled && <div className="fields-group">{g.label}</div>}
          <div className={`fields cols-${columnsFor(g.label)}`}>
            {g.entries.map((e) => {
              const i = sourceOf(e.key);
              return (
                <AttributeField
                  key={e.key}
                  el={sources[i]!}
                  name={e.attr}
                  spec={specs[i]!.get(e.attr)}
                  onEdit={onEdit}
                />
              );
            })}
          </div>
        </Fragment>
      ))}
      {mixed && (
        <div className="fields cols-2">
          <TextField el={main} node={text} onEdit={onEdit} />
        </div>
      )}
    </div>
  );
}

/** Grupos de campos curtos (datas, local, telefone) cabem em três colunas; o resto em duas. */
const THREE_COLUMNS = new Set(['Período', 'Localização', 'Contato', 'Local e idioma']);

function columnsFor(group: string): 2 | 3 {
  return THREE_COLUMNS.has(group) ? 3 : 2;
}

export function Attributes({ el, onEdit, showEmpty }: ViewProps) {
  return <FieldsBlock showEmpty={showEmpty} sources={[el]} onEdit={onEdit} />;
}

function TextField({ el, node, onEdit }: { el: XElement; node?: XText; onEdit: EditFn }) {
  const [draft, setDraft] = useState(node?.value ?? '');
  const id = useId();
  return (
    <div className="field field-wide">
      <label htmlFor={id}>Texto</label>
      <textarea
        id={id}
        rows={3}
        value={draft}
        onBlur={() => {
          if (draft === (node?.value ?? '')) return;
          if (node) node.value = draft;
          else {
            el.children.push({ kind: 'text', value: draft });
            el.selfClosing = false;
          }
          onEdit(`${elementLabel(el.name)} · texto`);
        }}
        onChange={(e) => setDraft(e.target.value)}
      />
    </div>
  );
}

/** Partes de um item que viram campos do mesmo formulário, sem caixa própria. */
const MERGED =
  /^(DADOS-BASICOS|DETALHAMENTO)|^(PALAVRAS-CHAVE|INFORMACOES-ADICIONAIS|SETORES-DE-ATIVIDADE)$/;

/** Saco de atributos sem identidade (AREA-DO-CONHECIMENTO-1, AUTORES): vira linha, não cartão. */
function isBag(el: XElement): boolean {
  return childElements(el).length === 0 && !el.attrs.some((a) => a.name.startsWith('SEQUENCIA'));
}

/** Filhos agrupados por nome, na ordem em que aparecem. */
function byName(els: XElement[]): [string, XElement[]][] {
  const map = new Map<string, XElement[]>();
  for (const e of els) map.set(e.name, [...(map.get(e.name) ?? []), e]);
  return [...map];
}

/** Atributos do título de subseção que entra no índice do item ("Neste item"). */
function outlineHead(base: string | undefined, index: number, label: string) {
  if (base === undefined) return {};
  // tabIndex -1: o índice leva o foco ao título, sem pôr o título na ordem do Tab.
  return { id: outlineId(base, index), [OUTLINE_HEAD_ATTR]: label, tabIndex: -1 };
}

/**
 * Elemento com atributos e filhos. Um contêiner de itens vira linha do tempo;
 * dentro de um item, as partes viram um formulário só, e os demais filhos,
 * subseções com título (linhas, quando se repetem).
 */
export function ElementView({
  anchorBase,
  depth = 0,
  el,
  filter,
  onEdit,
  outlineBase,
  showEmpty,
}: ViewProps & {
  anchorBase?: string;
  depth?: number;
  filter?: SectionFilter;
  /** No conteúdo de um cartão: ids dos títulos para o índice do item. */
  outlineBase?: string;
}) {
  const children = childElements(el).filter((c) => c.attrs.length > 0 || c.children.length > 0);
  const index = useReferenceIndex();
  const container = el.attrs.length === 0 && children.length > 0;

  // Dentro de um item, um contêiner de sacos (ÁREAS-DO-CONHECIMENTO) vira linhas.
  if (container && depth > 0 && children.every(isBag)) {
    return <Rows els={children} showEmpty={showEmpty} onEdit={onEdit} />;
  }
  if (container && children.every(isListItem)) {
    return (
      <ItemList
        anchorBase={anchorBase}
        depth={depth}
        filter={filter}
        items={children}
        showEmpty={showEmpty}
        view={viewForContainer(el.name, index)}
        onEdit={onEdit}
      />
    );
  }

  const parts = children.filter(
    (c) =>
      MERGED.test(c.name) &&
      childElements(c).length === 0 &&
      children.filter((x) => x.name === c.name).length === 1,
  );
  const rest = children.filter((c) => !parts.includes(c));
  const fields = <FieldsBlock showEmpty={showEmpty} sources={[el, ...parts]} onEdit={onEdit} />;
  // No endereço, os endereços vêm primeiro; preferência e contatos depois.
  const fieldsLast = FIELDS_AFTER_PARTS.has(el.name);
  return (
    <div className={`element depth-${Math.min(depth, 3)}`}>
      {!fieldsLast && fields}
      {byName(rest).map(([name, els], i) => (
        <section key={name} className="subsection">
          <h4 className="subsection-head" {...outlineHead(outlineBase, i, elementLabel(name))}>
            {elementLabel(name)}
            {els.length > 1 && <span className="count">{els.length}</span>}
          </h4>
          {els.length > 1 ? (
            <Rows els={els} showEmpty={showEmpty} onEdit={onEdit} />
          ) : (
            <ElementView depth={depth + 1} el={els[0]!} showEmpty={showEmpty} onEdit={onEdit} />
          )}
        </section>
      ))}
      {fieldsLast && (
        <section className="subsection">
          <h4
            className="subsection-head"
            {...outlineHead(outlineBase, byName(rest).length, 'Contatos e preferência')}
          >
            Contatos e preferência
          </h4>
          {fields}
        </section>
      )}
    </div>
  );
}

const FIELDS_AFTER_PARTS = new Set(['ENDERECO']);

function Rows({ els, onEdit, showEmpty }: { els: XElement[]; showEmpty: boolean; onEdit: EditFn }) {
  return (
    <div className="rows">
      {els.map((e, i) => (
        <div key={i} className="row">
          <ElementView depth={2} el={e} showEmpty={showEmpty} onEdit={onEdit} />
        </div>
      ))}
    </div>
  );
}
