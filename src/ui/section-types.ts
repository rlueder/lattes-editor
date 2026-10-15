// Que tipos de item novo fazem sentido em cada seção, para o estado vazio.
// Os ids são os dos módulos do Passo 2 (src/import-export/importable.ts).

import { importableTypes, type ProductionType } from '../model/production.ts';
import type { LattesSchema } from '../schema/types.ts';

const SECTION_MODULES: Record<string, string[]> = {
  bancas: ['bancas'],
  eventos: ['eventos'],
  orientacoes: ['orientacoes'],
  producoes: [
    'anais',
    'artigos',
    'apresentacao',
    'livros-capitulos',
    'artigos-aceitos',
    'textos-jornal',
    'outras-bibliograficas',
    'softwares',
    'produtos',
    'processos',
    'trabalhos-tecnicos',
    'outras-tecnicas',
    'artistica',
    'demais-trabalhos',
  ],
};

/** Tipos importáveis da seção, na ordem dos módulos acima; vazio se a seção não recebe itens. */
export function typesForSection(schema: LattesSchema, sectionId: string): ProductionType[] {
  const modules = SECTION_MODULES[sectionId];
  if (!modules) return [];
  const types = importableTypes(schema);
  return modules.flatMap((id) => types.filter((t) => t.module.id === id));
}

/** Seções que o Importar não preenche: o que dizer no estado vazio. */
/** O que cada seção guarda, para o estado vazio explicar antes de pedir ação. */
export const SECTION_DESCRIPTIONS: Record<string, string> = {
  atuacao: 'Vínculos com instituições e empresas, com cargos, períodos e atividades de cada um.',
  bancas: 'Participação em bancas de trabalhos de conclusão, mestrado, doutorado e concursos.',
  'dados-gerais': 'Identificação, resumo, endereços, idiomas, prêmios e áreas de atuação.',
  educacao: 'Produções e eventos marcados como divulgação científica para o público.',
  eventos: 'Congressos, seminários e outros eventos em que você participou ou que organizou.',
  formacao: 'Graduação, pós-graduação e cursos de formação complementar.',
  inovacao: 'Produções, patentes e projetos marcados como de potencial de inovação.',
  orientacoes: 'Orientações e supervisões de iniciação científica, TCC, mestrado e doutorado.',
  outros: 'Itens que não se encaixam nas outras seções.',
  patentes: 'Patentes, marcas, desenhos industriais, cultivares e outros registros.',
  producoes: 'Artigos, livros, capítulos, trabalhos em eventos e a produção técnica e artística.',
  projetos: 'Projetos de pesquisa, extensão e desenvolvimento, dentro de uma atuação.',
};

/** O que acontece com o item novo destas seções (src/model/general-items.ts). */
const BY_CHANGES = 'O item novo vai ao Lattes por "Enviar ao Lattes".';

export const EMPTY_NOTES: Record<string, string> = {
  atuacao: BY_CHANGES,
  educacao: 'Para um item aparecer aqui, ligue "Divulgação científica" ao editá-lo.',
  formacao: BY_CHANGES,
  inovacao: 'Para um item aparecer aqui, ligue "Potencial inovação" ao editá-lo.',
  patentes: `O programa de computador fica em Produções, como software. ${BY_CHANGES}`,
  projetos: `Projetos ficam dentro de uma atuação profissional. ${BY_CHANGES}`,
};

/** O botão de item novo das seções que não vão pelo Importar (src/model/general-items.ts). */
export const NEW_GENERAL_LABELS: Record<string, string> = {
  atuacao: 'Nova atuação ou atividade',
  'dados-gerais': 'Novo item',
  formacao: 'Nova formação',
  patentes: 'Nova patente ou registro',
  projetos: 'Novo projeto ou parte',
};
