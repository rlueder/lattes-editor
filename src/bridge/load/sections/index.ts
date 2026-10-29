// As seções de "Carregar do Lattes", na ordem em que são lidas.

import type { LoadSection } from '../loader.ts';
import { AREAS_ATUACAO } from './areas-atuacao.ts';
import { ATUACAO } from './atuacao.ts';
import { COMPLEMENTAR } from './complementar.ts';
import { DADOS_GERAIS } from './dados-gerais.ts';
import { ENDERECO } from './endereco.ts';
import { EVENTOS } from './eventos.ts';
import { FORMACAO } from './formacao.ts';
import { LISTAS } from './listas.ts';
import { PRODUCAO } from './producao.ts';

export const SECTIONS: LoadSection[] = [
  DADOS_GERAIS,
  ENDERECO,
  LISTAS,
  AREAS_ATUACAO,
  FORMACAO,
  COMPLEMENTAR,
  EVENTOS,
  ATUACAO,
  PRODUCAO,
];
