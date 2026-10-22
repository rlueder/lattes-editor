// Estado do item novo fora da produção (formação, atuação e o que entra nela,
// projeto e o que entra nele, patente e registros, dados gerais): qual seção
// pediu, o tipo escolhido, onde ele entra, o rascunho e o salvar.

import { useMemo, useState } from 'react';

import { elementLabel } from '../labels/labels.ts';
import {
  type AtuacaoChoice,
  atuacaoChoices,
  type GeneralType,
  generalTypes,
  hostChoices,
  insertGeneralItem,
  newGeneralItem,
} from '../model/general-items.ts';
import { knownAuthors } from '../model/production.ts';
import { childElements, firstChild, getAttr, parseXml, type XElement } from '../model/xml.ts';
import { lattesSchema as schema } from '../schema/lattes.ts';
import type { Session } from './use-production.ts';

export interface GeneralDraft {
  /** Tipo com `host`: o item que recebe o novo. */
  host?: XElement;
  /** Como a escolha do lugar mostrou o `host` ("Universidade X · Curso (2019, atual)"). */
  hostLabel?: string;
  item: XElement;
  type: GeneralType;
}

/** Os tipos que uma seção cria; vazio quando a seção não tem item novo fora da produção. */
export const typesFor = (sectionId: string): GeneralType[] =>
  generalTypes(schema, sectionId, elementLabel);

/** O texto de um item que é só texto (disciplina, treinamento). */
export const itemText = (item: XElement): string =>
  item.children.map((c) => (c.kind === 'text' ? c.value : '')).join('');

/** Troca o texto de um item que é só texto, mantendo os atributos. */
export function setItemText(item: XElement, text: string): void {
  item.children = text ? [{ kind: 'text', value: text }] : [];
  item.selfClosing = !text;
}

/** Título do item: o primeiro texto que diz o que ele é, para a nota do histórico. */
export function titleOf(item: XElement, type: GeneralType): string {
  // Patente e registros: o título (ou a denominação da cultivar) fica nos dados básicos.
  const basics = childElements(item).find((c) => c.name.startsWith('DADOS-BASICOS-'));
  const first = [
    'NOME-DO-PROJETO',
    'NOME-DO-PREMIO-OU-TITULO',
    'TITULO-DA-LINHA-DE-PESQUISA',
    'TITULO-DA-PRODUCAO-CT',
    'TITULO-ORIENTACAO',
    'NOME-INSTITUICAO',
    'NOME-CURSO',
    'CARGO-OU-FUNCAO',
    'NOME-DA-AREA-DO-CONHECIMENTO',
    'DESCRICAO-DO-IDIOMA',
    'IDIOMA',
  ]
    .map((attr) => getAttr(item, attr))
    .find((v) => v?.trim());
  return (
    (basics && (getAttr(basics, 'TITULO') || getAttr(basics, 'DENOMINACAO'))) ||
    first ||
    (type.text ? itemText(item).trim() : '') ||
    type.label
  );
}

/** O título do seletor de tipo, nas seções que têm mais de um. */
const PICKER_TITLES: Record<string, string> = {
  atuacao: 'Nova atuação ou atividade',
  'dados-gerais': 'Novo item dos dados gerais',
  formacao: 'Nova formação',
  patentes: 'Nova patente ou registro',
  projetos: 'Novo projeto ou parte de projeto',
};

/** O que dizer quando não há onde o item entrar. */
const NO_HOST: Record<string, string> = {
  'ATUACAO-PROFISSIONAL':
    'Este currículo ainda não tem atuação profissional. Crie a atuação antes.',
  ENSINO: 'Nenhuma atuação tem atividade de ensino. Crie a atividade antes.',
  'PESQUISA-E-DESENVOLVIMENTO':
    'Nenhuma atuação tem atividade de pesquisa e desenvolvimento. Crie a atividade antes.',
  'PROJETO-DE-PESQUISA': 'Este currículo ainda não tem projeto. Crie o projeto antes.',
  'TREINAMENTO-MINISTRADO': 'Nenhuma atuação tem atividade de treinamento. Crie a atividade antes.',
};

export function useGeneralItem(
  session: Session | null,
  setSession: (s: Session) => void,
  version: number,
  onEdit: (note: string) => void,
) {
  const [pickerFor, setPickerFor] = useState<string | null>(null);
  /** O tipo escolhido que ainda espera a escolha de onde entrar. */
  const [hostFor, setHostFor] = useState<GeneralType | null>(null);
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

  const hostsOf = (type: GeneralType): AtuacaoChoice[] =>
    session && type.host ? hostChoices(session.doc, type.host) : [];

  const begin = (type: GeneralType, host?: AtuacaoChoice) => {
    if (!session) return;
    setPickerFor(null);
    setHostFor(null);
    // O dono do currículo abre a lista de autores (patente) e a equipe (projeto).
    const dg = firstChild(session.doc.root, 'DADOS-GERAIS');
    const owner = dg && getAttr(dg, 'NOME-COMPLETO') ? authors[0] : undefined;
    setDraft({
      host: host?.el,
      hostLabel: host?.label,
      item: newGeneralItem(schema, type, owner),
      type,
    });
  };

  /** Um tipo escolhido: com onde entrar, pergunta antes (salvo quando só há um lugar). */
  const start = (type: GeneralType) => {
    if (!type.host) return begin(type);
    const hosts = hostsOf(type);
    if (hosts.length === 1) return begin(type, hosts[0]);
    setPickerFor(null);
    setHostFor(type);
  };

  /** Pedido da seção: um tipo só abre o formulário; as outras pedem o tipo antes. */
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
      host: draft.host,
      original,
      productionCounter: session.meta.nextSequencia,
    });
    setSession({ doc: session.doc, meta: { ...session.meta, nextSequencia } });
    onEdit(`Novo item: ${titleOf(item, draft.type)}`);
    setDraft(null);
  };

  const hosts = hostFor ? hostsOf(hostFor) : [];
  return {
    atuacoes,
    authors,
    cancel: () => setDraft(null),
    closePicker: () => {
      setPickerFor(null);
      setHostFor(null);
    },
    draft,
    /** A escolha de onde o item entra, depois do tipo. */
    hostPicker: hostFor
      ? {
          choices: hosts,
          empty: NO_HOST[hostFor.host ?? ''] ?? 'Não há onde este item entrar.',
          pick: (choice: AtuacaoChoice) => begin(hostFor, choice),
          title: hostFor.label,
        }
      : undefined,
    open,
    pickerTitle: (pickerFor && PICKER_TITLES[pickerFor]) || 'Novo item',
    pickerTypes: pickerFor ? typesFor(pickerFor) : [],
    save,
    start,
  };
}
