// As listas do Lattes lidas pelo conector (use-lattes-lists.ts), para os campos
// que as usam lá no fundo da árvore (AttributeField, AreasEditor). Sem
// provedor, nenhuma lista: os campos ficam texto livre, como antes.

import { createContext, useContext } from 'react';

import type { Course, Institution } from '../bridge/lattes-lists.ts';
import type { XElement } from '../model/xml.ts';
import type { LiveAvailability } from './live-lists.ts';

export interface LattesLists extends LiveAvailability {
  /** Os cursos da instituição do item no nível dele; rejeita com o motivo. */
  loadCourses: (el: XElement) => Promise<Course[]>;
  /** Busca de instituição no Lattes (só com o conector ligado); rejeita com o motivo. */
  searchInstitutions: (query: string, level?: string) => Promise<Institution[]>;
}

const unavailable = () => Promise.reject(new Error('O conector não está ligado'));

export const NO_LISTS: LattesLists = {
  courses: false,
  loadCourses: unavailable,
  search: false,
  searchInstitutions: unavailable,
};

export const LattesListsContext = createContext<LattesLists>(NO_LISTS);

export function useLattesListsContext(): LattesLists {
  return useContext(LattesListsContext);
}
