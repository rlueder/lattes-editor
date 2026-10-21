// As listas do Lattes lidas pelo conector (use-lattes-lists.ts), para os campos
// que as usam lá no fundo da árvore (AttributeField, AreasEditor). Sem
// provedor, nenhuma lista: os campos ficam texto livre, como antes.

import { createContext, useContext } from 'react';

import type { Course, Institution, Organ } from '../bridge/lattes-lists.ts';
import type { OrganWindow } from '../bridge/organ-windows.ts';
import type { XElement } from '../model/xml.ts';
import type { LiveAvailability } from './live-lists.ts';

export interface LattesLists extends LiveAvailability {
  /**
   * Os cursos da instituição do item no nível dele (num tipo com várias
   * naturezas, o da NATUREZA do item); rejeita com o motivo.
   */
  loadCourses: (el: XElement, nature?: string) => Promise<Course[]>;
  /**
   * Os órgãos da instituição (o código do XML, sem a letra) ou as unidades de
   * um órgão, na janela de órgãos do projeto ou na da atividade; rejeita com
   * o motivo.
   */
  loadOrgans: (institution: string, parent?: string, organWindow?: OrganWindow) => Promise<Organ[]>;
  /** Busca de instituição no Lattes (só com o conector ligado); rejeita com o motivo. */
  searchInstitutions: (query: string, level?: string) => Promise<Institution[]>;
}

const unavailable = () => Promise.reject(new Error('O conector não está ligado'));

export const NO_LISTS: LattesLists = {
  courses: false,
  loadCourses: unavailable,
  loadOrgans: unavailable,
  search: false,
  searchInstitutions: unavailable,
};

export const LattesListsContext = createContext<LattesLists>(NO_LISTS);

export function useLattesListsContext(): LattesLists {
  return useContext(LattesListsContext);
}
