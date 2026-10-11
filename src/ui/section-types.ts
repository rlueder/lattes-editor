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
  patentes: 'Patentes, programas de computador, marcas e outros registros.',
  producoes: 'Artigos, livros, capítulos, trabalhos em eventos e a produção técnica e artística.',
  projetos: 'Projetos de pesquisa, extensão e desenvolvimento, dentro de uma atuação.',
};

export const EMPTY_NOTES: Record<string, string> = {
  atuacao:
    'Atuações não entram pelo Importar do Lattes; cadastre no próprio Lattes e recarregue a exportação.',
  'dados-gerais': 'A exportação não trouxe dados gerais.',
  educacao:
    'Aparecem aqui os itens marcados como divulgação científica. Ao editar um item, ligue "Divulgação científica".',
  formacao:
    'Formações não entram pelo Importar do Lattes; cadastre no próprio Lattes e recarregue a exportação.',
  inovacao:
    'Aparecem aqui os itens marcados com potencial de inovação. Ao editar um item, ligue "Potencial inovação".',
  outros: 'Nada fora das outras seções nesta exportação.',
  patentes:
    'Patentes e registros não entram pelo Importar do Lattes; cadastre no próprio Lattes e recarregue a exportação.',
  projetos:
    'Projetos ficam dentro de uma atuação profissional e não entram pelo Importar; cadastre no Lattes, em Atuação.',
};
