// Pessoas do currículo: quem assina junto, quem foi orientado, quem esteve na
// mesma banca ou no mesmo projeto, e quem orientou a própria pessoa. A chave
// é o nome sem acento e sem caixa; variações ("Silva, J." e "João Silva") só
// se juntam quando a revisão de consistência souber fundi-las.

import { type Period, within } from './aggregate.ts';
import {
  type Committee,
  type CvData,
  type Degree,
  type PanoramaItem,
  personKey,
  type Production,
  type Project,
  type Supervision,
} from './model.ts';

export interface Person {
  committees: Committee[];
  /** Formações em que esta pessoa orientou a dona do currículo. */
  degrees: Degree[];
  key: string;
  name: string;
  productions: Production[];
  projects: Project[];
  supervisions: Supervision[];
  /** Anos das coautorias e bancas no período. */
  years: number[];
}

export type Tie = 'banca' | 'coautoria' | 'orientacao' | 'projeto';

/** O filtro "Laço" do painel; orientação já tem seção própria na lista. */
export const TIES: { key: Tie; label: string }[] = [
  { key: 'coautoria', label: 'Coautoria' },
  { key: 'banca', label: 'Banca' },
  { key: 'projeto', label: 'Projeto' },
];

/**
 * As seções de pessoas da lista, na ordem em que aparecem. Quem só esteve em
 * banca não tem seção de pessoa: aparece nas linhas da seção Bancas.
 */
export const ROLES = ['Orientadores', 'Orientandos', 'Coautores', 'Projetos'] as const;
export type Role = 'Bancas' | (typeof ROLES)[number];

/** O papel mais específico da pessoa, que decide a seção. */
export function roleOf(p: Person): Role {
  if (p.degrees.length) return 'Orientadores';
  if (p.supervisions.length) return 'Orientandos';
  if (p.productions.length) return 'Coautores';
  if (p.projects.length) return 'Projetos';
  return 'Bancas';
}

/** A lista em seções, na ordem de ROLES, cada uma mantendo a ordem por contagem. */
export function byRole(list: Person[]): { people: Person[]; role: Role }[] {
  return ROLES.map((role) => ({ people: list.filter((p) => roleOf(p) === role), role })).filter(
    (g) => g.people.length > 0,
  );
}

export function personItems(p: Person): PanoramaItem[] {
  return [...p.productions, ...p.committees, ...p.projects, ...p.supervisions, ...p.degrees];
}

export function hasTie(p: Person, tie: Tie): boolean {
  if (tie === 'coautoria') return p.productions.length > 0;
  if (tie === 'orientacao') return p.supervisions.length + p.degrees.length > 0;
  if (tie === 'banca') return p.committees.length > 0;
  return p.projects.length > 0;
}

export function people(cv: CvData, p: Period): Person[] {
  const map = new Map<string, Person>();
  const get = (full: string, cit = ''): Person | undefined => {
    const name = full || cit;
    const key = personKey(name);
    if (!key) return undefined;
    let person = map.get(key);
    if (!person) {
      person = {
        committees: [],
        degrees: [],
        key,
        name,
        productions: [],
        projects: [],
        supervisions: [],
        years: [],
      };
      map.set(key, person);
    }
    return person;
  };
  const selfKeys = new Set(
    cv.productions.flatMap((x) => x.authors.filter((a) => a.self).map((a) => personKey(a.full))),
  );
  selfKeys.add(personKey(cv.name));
  const isSelf = (full: string) => selfKeys.has(personKey(full));

  for (const prod of within(cv.productions, p)) {
    for (const a of prod.authors) {
      if (a.self) continue;
      const person = get(a.full, a.cit);
      person?.productions.push(prod);
      if (prod.year) person?.years.push(prod.year);
    }
  }
  for (const c of within(cv.committees, p)) {
    for (const m of c.members) {
      if (isSelf(m.full)) continue;
      const person = get(m.full, m.cit);
      person?.committees.push(c);
      if (c.year) person?.years.push(c.year);
    }
  }
  for (const pr of cv.projects)
    for (const m of pr.team) if (!isSelf(m.full)) get(m.full, m.cit)?.projects.push(pr);
  for (const s of cv.supervisions) {
    if (!s.student) continue;
    const person = get(s.student);
    person?.supervisions.push(s);
    if (s.year) person?.years.push(s.year);
  }
  for (const d of cv.degrees) if (d.advisor) get(d.advisor)?.degrees.push(d);

  return [...map.values()].sort(
    (a, b) =>
      b.productions.length - a.productions.length ||
      personItems(b).length - personItems(a).length ||
      a.name.localeCompare(b.name, 'pt-BR'),
  );
}

export interface Collaboration {
  avgAuthors: number;
  solo: number;
  students: number;
  /** Pessoas orientadas que assinam alguma produção junto. */
  studentsCoauthoring: number;
  withAuthors: number;
}

export function collaboration(cv: CvData, p: Period, list: Person[]): Collaboration {
  const withAuthors = within(cv.productions, p).filter((x) => x.authors.length > 0);
  const total = withAuthors.reduce((n, x) => n + x.authors.length, 0);
  return {
    avgAuthors: withAuthors.length ? total / withAuthors.length : 0,
    solo: withAuthors.filter((x) => x.authors.length === 1).length,
    students: list.filter((x) => x.supervisions.length > 0).length,
    studentsCoauthoring: list.filter((x) => x.supervisions.length > 0 && x.productions.length > 0)
      .length,
    withAuthors: withAuthors.length,
  };
}

export interface Edge {
  a: string;
  b: string;
  items: Production[];
}

/** Pares de coautores (entre os escolhidos) que assinaram juntos no período. */
export function coauthorEdges(cv: CvData, p: Period, keys: Set<string>): Edge[] {
  const edges = new Map<string, Edge>();
  for (const prod of within(cv.productions, p)) {
    const ks = [
      ...new Set(prod.authors.filter((a) => !a.self).map((a) => personKey(a.full || a.cit))),
    ].filter((k) => keys.has(k));
    ks.sort();
    for (let i = 0; i < ks.length; i++) {
      for (let j = i + 1; j < ks.length; j++) {
        const id = `${ks[i]}|${ks[j]}`;
        const edge = edges.get(id) ?? { a: ks[i]!, b: ks[j]!, items: [] };
        edge.items.push(prod);
        edges.set(id, edge);
      }
    }
  }
  return [...edges.values()];
}

/** "Ana Beatriz Souza Lima" → "Ana Lima", para rótulos curtos na rede. */
export function shortName(name: string): string {
  if (name.includes(',')) return name;
  const parts = name.split(/\s+/).filter(Boolean);
  return parts.length > 2 ? `${parts[0]} ${parts.at(-1)}` : name;
}
