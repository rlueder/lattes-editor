// Campos que escolhem numa lista lida no Lattes pelo conector (LAT-48): área do
// conhecimento, agência de fomento, instituição (busca) e curso. Cada escolha
// grava o código e o nome juntos (live-lists.ts). Valor que não está na lista
// continua visível, "como está salvo", e só muda quando a pessoa escolhe outro.

import { Combobox } from '@base-ui/react/combobox';
import { useEffect, useMemo, useRef, useState } from 'react';

import { type Course, type Institution, MIN_INSTITUTION_QUERY } from '../bridge/lattes-lists.ts';
import { areaPath } from '../forms/area-path.ts';
import type { KnowledgeArea } from '../model/production.ts';
import { getAttr, type XElement } from '../model/xml.ts';
import { useEditor } from './editor-context.ts';
import { CheckIcon, ChevronIcon } from './icons.tsx';
import type { LattesLists } from './lattes-lists-context.ts';
import {
  agencyAttrs,
  applyAgency,
  applyCourse,
  applyInstitution,
  areaOptions,
  courseAttrs,
  EMPTY_AREA,
  findAgency,
  findArea,
  findCourse,
  institutionAttrs,
  institutionPair,
  itemNature,
  type LiveKind,
  livePairs,
  readArea,
  writeArea,
} from './live-lists.ts';
import { OrganControl } from './OrganField.tsx';
import { ComboSelect } from './primitives/ComboSelect.tsx';

/** Valor das opções "como está salvo": escolhê-las não muda nada. */
const SAVED = '\u0000salvo';

interface Common {
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
  id?: string;
}

interface AreaPickerProps extends Common {
  area: KnowledgeArea;
  areas: NonNullable<LattesLists['areas']>;
  'aria-label'?: string;
  onChange: (area: KnowledgeArea) => void;
}

/**
 * Uma área da tabela do Lattes, com busca pelo caminho ("Matemática › Álgebra
 * › Álgebra Comutativa"). A escolha dá os quatro nomes de uma vez.
 */
export function AreaPicker({ area, areas, onChange, ...common }: AreaPickerProps) {
  const options = areaOptions(areas);
  const match = findArea(areas, area);
  const empty = !area.bigArea && !area.area && !area.subArea && !area.specialty;
  const saved = !match && !empty;
  return (
    <ComboSelect
      {...common}
      options={[
        { label: '(escolha a área)', value: '' },
        ...(saved ? [{ label: `${areaPath(area)} (como está salvo)`, value: SAVED }] : []),
        ...options,
      ]}
      value={match?.value ?? (saved ? SAVED : '')}
      onChange={(code) => {
        if (code === SAVED) return;
        onChange(options.find((o) => o.value === code)?.area ?? EMPTY_AREA);
      }}
    />
  );
}

interface ControlProps {
  /** O atributo do campo: a instituição principal ou a do sanduíche e da cotutela. */
  attr?: string;
  common: Common;
  el: XElement;
  kind: Exclude<LiveKind, 'area-derivada'>;
  lists: LattesLists;
  /** Chamado depois de gravar, com o que mudou, para entrar no histórico. */
  onChanged: () => void;
}

/** O controle do campo, sem rótulo: AttributeField põe o rótulo e o resto. */
export function LiveListControl({ attr, common, el, kind, lists, onChanged }: ControlProps) {
  const done = (changed: boolean) => changed && onChanged();
  if (kind === 'area' && lists.areas) {
    return (
      <AreaPicker
        {...common}
        area={readArea(el)}
        areas={lists.areas}
        onChange={(a) => done(writeArea(el, a))}
      />
    );
  }
  if (kind === 'agencia' && lists.agencies) {
    const agencies = lists.agencies;
    const value = getAttr(el, agencyAttrs(el).name) ?? '';
    const match = findAgency(agencies, el);
    const saved = !match && value !== '';
    return (
      <ComboSelect
        {...common}
        options={[
          { label: '(sem agência)', value: '' },
          ...(saved ? [{ label: `${value} (como está salvo)`, value: SAVED }] : []),
          ...agencies.map((a) => ({ label: a.name, value: a.code })),
        ]}
        value={match?.code ?? (saved ? SAVED : '')}
        onChange={(code) => {
          if (code === SAVED) return;
          done(
            applyAgency(
              el,
              agencies.find((a) => a.code === code),
            ),
          );
        }}
      />
    );
  }
  if (kind === 'instituicao') {
    return (
      <InstitutionSearch
        attr={attr}
        common={common}
        el={el}
        level={livePairs(el.name)?.searchLevel}
        search={lists.searchInstitutions}
        onPick={(inst) => done(applyInstitution(el, inst, attr))}
      />
    );
  }
  if (kind === 'curso') {
    return <CourseControl common={common} el={el} lists={lists} onChanged={onChanged} />;
  }
  if (kind === 'orgao' || kind === 'unidade') {
    return <OrganControl common={common} el={el} kind={kind} lists={lists} onChanged={onChanged} />;
  }
  return null;
}

interface SearchProps {
  attr?: string;
  common: Common;
  el: XElement;
  level?: string;
  search: LattesLists['searchInstitutions'];
  onPick: (inst: Institution) => void;
}

type SearchState =
  | { kind: 'buscando' }
  | { detail: string; kind: 'erro' }
  | { kind: 'curto' }
  | { kind: 'pronto'; results: Institution[] };

/** Quanto esperar a pessoa parar de digitar antes de buscar no Lattes. */
const SEARCH_DELAY_MS = 400;

/**
 * Busca de instituição no diretório do Lattes, como a janela do próprio
 * Lattes: a partir de 3 letras, depois de uma pausa na digitação. Texto que
 * não vira escolha volta ao nome salvo ao sair do campo.
 */
function InstitutionSearch({ attr, common, el, level, onPick, search }: SearchProps) {
  const attrs = institutionPair(el, attr);
  const name = getAttr(el, attrs.name) ?? '';
  const code = getAttr(el, attrs.code) ?? '';
  const current = useMemo<Institution | null>(
    () => (name ? { code: code || SAVED, label: name, name } : null),
    [code, name],
  );
  const [query, setQuery] = useState('');
  const [state, setState] = useState<SearchState>({ kind: 'curto' });
  const latest = useRef(0);

  useEffect(() => {
    const q = query.trim();
    const n = ++latest.current;
    if (q.length < MIN_INSTITUTION_QUERY || q === name) {
      setState({ kind: 'curto' });
      return;
    }
    setState({ kind: 'buscando' });
    const timer = setTimeout(() => {
      search(q, level)
        .then((results) => n === latest.current && setState({ kind: 'pronto', results }))
        .catch(
          (err: unknown) =>
            n === latest.current &&
            setState({
              detail: err instanceof Error ? err.message : 'falha inesperada',
              kind: 'erro',
            }),
        );
    }, SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [level, name, query, search]);

  const results = state.kind === 'pronto' ? state.results : [];
  const items = current ? [current, ...results.filter((r) => r.code !== current.code)] : results;
  const empty =
    state.kind === 'buscando'
      ? 'Buscando no Lattes…'
      : state.kind === 'erro'
        ? `Não deu para buscar: ${state.detail}`
        : state.kind === 'pronto'
          ? 'Nada encontrado no Lattes'
          : `Digite ao menos ${MIN_INSTITUTION_QUERY} letras do nome`;

  return (
    <Combobox.Root
      autoHighlight
      filteredItems={state.kind === 'curto' && current ? [current] : results}
      isItemEqualToValue={(a: Institution, b: Institution) => a.code === b.code}
      items={items}
      itemToStringLabel={(o: Institution) => o.name}
      itemToStringValue={(o: Institution) => o.code}
      value={current}
      onInputValueChange={setQuery}
      onValueChange={(next) => {
        const inst = next as Institution | null;
        if (inst && inst.code !== SAVED && inst.code !== current?.code) onPick(inst);
      }}
    >
      <Combobox.InputGroup className="select-trigger combo">
        <Combobox.Input className="combo-input" placeholder="Buscar no Lattes" {...common} />
        <Combobox.Trigger aria-label="Mostrar os resultados" className="combo-toggle">
          <ChevronIcon />
        </Combobox.Trigger>
      </Combobox.InputGroup>
      <Combobox.Portal>
        <Combobox.Positioner className="select-positioner" sideOffset={4}>
          <Combobox.Popup aria-busy={state.kind === 'buscando'} className="select-popup">
            <Combobox.Empty className="combo-empty">{empty}</Combobox.Empty>
            <Combobox.List>
              {(o: Institution) => (
                <Combobox.Item key={o.code} className="select-item" value={o}>
                  <Combobox.ItemIndicator className="select-indicator">
                    <CheckIcon />
                  </Combobox.ItemIndicator>
                  <span>{o.code === SAVED ? `${o.label} (como está salvo)` : o.label}</span>
                </Combobox.Item>
              )}
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  );
}

type CourseState =
  | { courses: Course[]; kind: 'pronto' }
  | { detail: string; kind: 'erro' }
  | { kind: 'carregando' }
  | { kind: 'parado' };

/**
 * Curso da instituição escolhida, no nível da formação. A lista só é lida no
 * Lattes quando a pessoa pede, para abrir a formação não disparar uma leitura
 * por item.
 */
function CourseControl({ common, el, lists, onChanged }: Omit<ControlProps, 'kind'>) {
  // Num tipo com várias naturezas, a lista de cursos é a da natureza do item.
  const { root } = useEditor();
  const institution = getAttr(el, institutionAttrs(el).code) ?? '';
  const value = getAttr(el, courseAttrs(el).name) ?? '';
  const [state, setState] = useState<CourseState>({ kind: 'parado' });
  // Cada leitura leva um número; a resposta de uma leitura que ficou para trás
  // (outra instituição, outro clique, campo fechado) é ignorada, para nunca
  // oferecer os cursos de outra instituição.
  const latest = useRef(0);
  // Outra instituição, outra lista.
  useEffect(() => {
    latest.current++;
    setState({ kind: 'parado' });
  }, [institution]);
  useEffect(
    () => () => {
      latest.current++;
    },
    [],
  );

  const load = () => {
    const n = ++latest.current;
    setState({ kind: 'carregando' });
    lists
      .loadCourses(el, itemNature(root, el))
      .then((courses) => n === latest.current && setState({ courses, kind: 'pronto' }))
      .catch(
        (err: unknown) =>
          n === latest.current &&
          setState({
            detail: err instanceof Error ? err.message : 'falha inesperada',
            kind: 'erro',
          }),
      );
  };

  if (state.kind !== 'pronto') {
    return (
      <span className="live-list-pending">
        <span className="readonly-value" id={common.id}>
          {value || '(vazio)'}
        </span>
        {state.kind === 'carregando' ? (
          <span className="muted" role="status">
            Lendo os cursos no Lattes…
          </span>
        ) : (
          <button className="link-btn" type="button" onClick={load}>
            {state.kind === 'erro' ? 'Tentar de novo' : 'Escolher na lista do Lattes'}
          </button>
        )}
        {state.kind === 'erro' && (
          <span className="field-note" role="status">
            Não deu para ler os cursos: {state.detail}
          </span>
        )}
      </span>
    );
  }

  const match = findCourse(state.courses, el);
  const saved = !match && value !== '';
  return (
    <ComboSelect
      {...common}
      options={[
        { label: '(sem curso)', value: '' },
        ...(saved ? [{ label: `${value} (como está salvo)`, value: SAVED }] : []),
        ...state.courses.map((c) => ({ label: c.label, value: c.value })),
      ]}
      value={match?.value ?? (saved ? SAVED : '')}
      onChange={(v) => {
        if (v === SAVED) return;
        if (
          applyCourse(
            el,
            state.courses.find((c) => c.value === v),
          )
        )
          onChanged();
      }}
    />
  );
}
