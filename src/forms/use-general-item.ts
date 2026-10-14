// Estado do item novo fora da produção (formação, atuação, projeto, patente):
// qual seção pediu, o nível escolhido, o rascunho e o salvar.

import { useMemo, useState } from 'react';

import { elementLabel } from '../labels/labels.ts';
import {
  atuacaoChoices,
  type GeneralType,
  generalTypes,
  insertGeneralItem,
  newGeneralItem,
} from '../model/general-items.ts';
import { knownAuthors } from '../model/production.ts';
import { firstChild, getAttr, parseXml, type XElement } from '../model/xml.ts';
import { lattesSchema as schema } from '../schema/lattes.ts';
import type { Session } from './use-production.ts';

export interface GeneralDraft {
  item: XElement;
  type: GeneralType;
}

/** Os tipos que uma seção cria; vazio quando a seção não tem item novo fora da produção. */
export const typesFor = (sectionId: string): GeneralType[] =>
  generalTypes(schema, sectionId, elementLabel);

/** Título do item: o primeiro texto que diz o que ele é, para a nota do histórico. */
function titleOf(item: XElement, type: GeneralType): string {
  const basics = firstChild(item, 'DADOS-BASICOS-DA-PATENTE');
  return (
    getAttr(item, 'NOME-DO-PROJETO') ||
    (basics && getAttr(basics, 'TITULO')) ||
    getAttr(item, 'NOME-INSTITUICAO') ||
    type.label
  );
}

export function useGeneralItem(
  session: Session | null,
  setSession: (s: Session) => void,
  version: number,
  onEdit: (note: string) => void,
) {
  const [pickerFor, setPickerFor] = useState<string | null>(null);
  const [draft, setDraft] = useState<GeneralDraft | null>(null);

  const authors = useMemo(
    () => (session ? knownAuthors(session.doc) : []),
    // O documento é mutado no lugar; `version` avisa a mudança.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [session, version],
  );
  const atuacoes = useMemo(
    () => (session ? atuacaoChoices(session.doc) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [session, version],
  );

  const start = (type: GeneralType) => {
    if (!session) return;
    setPickerFor(null);
    // O dono do currículo abre a lista de autores (patente) e a equipe (projeto).
    const dg = firstChild(session.doc.root, 'DADOS-GERAIS');
    const owner = dg && getAttr(dg, 'NOME-COMPLETO') ? authors[0] : undefined;
    setDraft({ item: newGeneralItem(schema, type, owner), type });
  };

  /** Pedido da seção: um tipo só abre o formulário; a formação pede o nível antes. */
  const open = (sectionId: string) => {
    const types = typesFor(sectionId);
    if (types.length === 1) start(types[0]!);
    else if (types.length > 1) setPickerFor(sectionId);
  };

  const save = (item: XElement, atuacaoKey?: string) => {
    if (!session || !draft) return;
    const original = parseXml(session.meta.originalXml).root;
    const atuacao = atuacaoKey ? atuacoes.find((a) => a.key === atuacaoKey)?.el : undefined;
    const nextSequencia = insertGeneralItem(schema, session.doc, draft.type, item, {
      atuacao,
      original,
      productionCounter: session.meta.nextSequencia,
    });
    setSession({ doc: session.doc, meta: { ...session.meta, nextSequencia } });
    onEdit(`Novo item: ${titleOf(item, draft.type)}`);
    setDraft(null);
  };

  return {
    atuacoes,
    authors,
    cancel: () => setDraft(null),
    closePicker: () => setPickerFor(null),
    draft,
    open,
    pickerTypes: pickerFor ? typesFor(pickerFor) : [],
    save,
    start,
  };
}
