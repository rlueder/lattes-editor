// Produções bibliográficas, em três arquivos: artigos e trabalhos em anais,
// livros e textos, e os demais tipos. Campos e opções: censo de 15/10/2026
// (docs/lattes-formularios/); cada arquivo diz de onde vem cada ligação e o
// que é inferido.

import type { ProductionTarget } from '../types.ts';
import { ARTIGO_TARGETS } from './bibliografica-artigos.ts';
import { DEMAIS_TARGETS } from './bibliografica-demais.ts';
import { LIVRO_TARGETS } from './bibliografica-livros.ts';

export const BIBLIOGRAFICA_TARGETS: ProductionTarget[] = [
  ...ARTIGO_TARGETS,
  ...LIVRO_TARGETS,
  ...DEMAIS_TARGETS,
];
