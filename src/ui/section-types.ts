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
