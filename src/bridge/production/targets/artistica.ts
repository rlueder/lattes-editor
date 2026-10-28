// Produções artísticas e culturais: artes cênicas, música, artes visuais e
// outra produção artística. Um formulário só, GN_ARTE com POST para
// PKG_ARTE_NOVA.FORM, com F_TIPO (AC, MU, AV, OU) e campos que mudam por
// tipo; a lista é pkg_arte_nova.lista com f_cod_tipo (seção 17 de
// docs/lattes_internals.md). Campos e opções: censo de 15/10/2026, formulário
// de inclusão de cada tipo, e as listas f_cod_prod, f_tpo_evento e f_tpo_ativ
// dele.
//
// Inferido em todos (nenhum item artístico no currículo de quem capturou): o
// link de cada linha da lista (pkg_arte_nova.form com f_seq) e a ligação de
// cada campo com o atributo, pelo nome e pelo rótulo. A natureza (lista
// F_COD_PROD) se liga ao enumerado pelo rótulo da opção. A lista do menu foi
// vista só com f_sta_divulgacao_cientifica=S na captura de 13/10/2026; o
// motor prefere a variante sem o parâmetro quando o menu tem as duas.
//
// Ficam à mão, porque o campo é oculto no formulário do tipo: a data de
// encerramento nas artes cênicas e na música (f_dta_fim) e o itinerante nas
// artes cênicas (f_itinerante). Na outra produção artística, a EXPOSICAO:
// o campo F_EXPOSICAO tem o rótulo "Obra de referência", e o tipo não tem
// esse atributo.

import { byTable } from '../mappers.ts';
import type { FieldMap, ProductionTarget } from '../types.ts';
import {
  ALL_GRIDS,
  basics,
  checkbox,
  INFO,
  MEDIA,
  oneOf,
  OUTREACH,
  slashDate,
  under,
} from './comum-tecnica-artistica.ts';

function arte(
  type: string,
  element: string,
  main: string,
  detail: string,
  fields: {
    details: Record<string, FieldMap | string>;
    extra: Record<string, FieldMap | string>;
    /** Atributos do detalhamento que ficam à mão, com o motivo. */
    manual?: Record<string, string>;
  },
): ProductionTarget {
  return {
    element,
    ...(fields.manual ? { manual: under(detail, fields.manual) as Record<string, string> } : {}),
    fields: {
      ...under(main, {
        ...basics('TITULO', 'TITULO-INGLES'),
        'FLAG-DIVULGACAO-CIENTIFICA': OUTREACH,
        'HOME-PAGE': 'f_homepage',
        'MEIO-DE-DIVULGACAO': MEDIA,
        ...fields.extra,
      }),
      ...under(detail, fields.details),
      ...INFO,
    },
    form: { action: 'PKG_ARTE_NOVA.FORM', name: 'GN_ARTE' },
    grids: [...ALL_GRIDS],
    id: `arte-${type}`,
    list: {
      formProc: 'pkg_arte_nova.form',
      params: { f_cod_tipo: type },
      proc: 'pkg_arte_nova.lista',
    },
    title: { attr: 'TITULO', child: main },
    year: { attr: 'ANO', child: main },
  };
}

const nature = (table: Record<string, string>): FieldMap => ({
  field: 'F_COD_PROD',
  toForm: byTable(table),
});

/** Os campos do evento e do prêmio, iguais nas artes cênicas, na música e nas artes visuais. */
const EVENT = {
  'CIDADE-DO-EVENTO': 'f_cidade',
  'INSTITUICAO-PROMOTORA-DO-EVENTO': 'f_inst',
  'LOCAL-DO-EVENTO': 'f_local',
  PREMIACAO: 'f_premiacao',
  TEMPORADA: 'f_temporada',
};

/**
 * A estreia e a obra de referência, nas artes cênicas e na música. A obra de
 * referência é o campo F_EXPOSICAO, pelo rótulo ("Obra de referência").
 */
const PREMIERE = {
  'ANO-DA-OBRA-DE-REFERENCIA': 'f_ano_obra',
  'AUTOR-DA-OBRA-DE-REFERENCIA': 'f_autor_obra',
  'DATA-ESTREIA': { field: 'f_dta_ini', toForm: slashDate },
  DURACAO: 'f_duracao',
  'INSTITUICAO-PROMOTORA-DO-PREMIO': 'f_inst_premio',
  'LOCAL-DE-ESTREIA': 'f_local_estreia',
  'OBRA-DE-REFERENCIA': 'F_EXPOSICAO',
};

const optionsOf = (list: string) => list.split('|');

const ARTES_CENICAS = arte(
  'AC',
  'ARTES-CENICAS',
  'DADOS-BASICOS-DE-ARTES-CENICAS',
  'DETALHAMENTO-DE-ARTES-CENICAS',
  {
    details: {
      ...EVENT,
      ...PREMIERE,
      'ATIVIDADE-DOS-AUTORES': {
        field: 'f_tpo_ativ',
        toForm: oneOf(
          optionsOf(
            'Aderecista|Ator|Bonequeiro|Caracterizador|Cenógrafo|Coreógrafo|Dançarino|Diretor|Diretor Musical|Dramaturgista|Dramaturgo|Encenador|Figurinista|Iluminador|Maquiador|Preparador corporal|Preparador vocal|Outra',
          ),
        ),
      },
      'TIPO-DE-EVENTO': {
        field: 'f_tpo_evento',
        toForm: oneOf(
          optionsOf('Apresentação única|Concurso|Festival|Teledrama|Temporada|Turnê|Outro'),
        ),
      },
    },
    extra: {
      NATUREZA: nature({
        AUDIOVISUAL: '3A1',
        CIRCENSE: '3A2',
        COREOGRAFICA: '3A3',
        DIVERSAS: '3A4',
        OPERISTICA: '3A5',
        OUTRA: '3AZ',
        PERFORMATICA: '3A6',
        RADIALISTICA: '3A7',
        TEATRAL: '3A8',
      }),
    },
  },
);

const MUSICA = arte('MU', 'MUSICA', 'DADOS-BASICOS-DA-MUSICA', 'DETALHAMENTO-DA-MUSICA', {
  details: {
    ...EVENT,
    ...PREMIERE,
    'ATIVIDADE-DOS-AUTORES': {
      field: 'f_tpo_ativ',
      toForm: oneOf(optionsOf('Arranjador|Cantor|Compositor|Instrumentista|Regente|Solista|Outra')),
    },
    'FLAG-INEDITISMO-DA-OBRA': { field: 'f_inedito', toForm: checkbox },
    'FORMACAO-INSTRUMENTAL': 'f_form_instr',
  },
  extra: {
    NATUREZA: nature({
      APRESENTACAO_DE_OBRA: '3B1',
      ARRANJO: '3B2',
      AUDIOVISUAL: '3B3',
      COMPOSICAO: '3B4',
      DIVERSAS: '3B5',
      INTERPRETACAO: '3B6',
      OUTRA: '3BZ',
      PUBLICACAO_DE_PARTITURA: '3B7',
      REGISTRO_FONOGRAFICO: '3B8',
      TRILHA_SONORA: '3B9',
    }),
  },
  // Uma música de teste gravada com "Récita Lírica" em f_tpo_evento (a página
  // de alteração o mostra marcado) veio na exportação de 27/10/2026 com
  // TIPO-DE-EVENTO="NAO_INFORMADO". O que se grava não volta no XML.
  manual: {
    'TIPO-DE-EVENTO':
      'A exportação do Lattes não traz o tipo de evento da música: gravado no formulário, ele volta como NAO_INFORMADO',
  },
});

const ARTES_VISUAIS = arte(
  'AV',
  'ARTES-VISUAIS',
  'DADOS-BASICOS-DE-ARTES-VISUAIS',
  'DETALHAMENTO-DE-ARTES-VISUAIS',
  {
    details: {
      ...EVENT,
      'ATIVIDADE-DOS-AUTORES': {
        field: 'f_tpo_ativ',
        toForm: oneOf(
          optionsOf(
            'Aderecista|Animador|Artista Multimídia|Artista Plástico|Artista Visual|Cenógrafo|Cineasta|Curador|Desenhista|Escultor|Figurinista|Fotógrafo|Gravador|Ilustrador|Performer|Pintor|Programador visual|Roteirista|Vídeo Maker|Web artist|Outra',
          ),
        ),
      },
    },
    extra: {
      NATUREZA: nature({
        ANIMACAO: '3C1',
        COMPUTACAO_GRAFICA: '3C2',
        DESENHO: '3C3',
        DIVERSAS: '3C4',
        ESCULTURA: '3C5',
        FILME: '3C6',
        FOTOGRAFIA: '3C7',
        GRAVURA: '3C8',
        ILUSTRACAO: '3C9',
        INSTALACAO: '3CA',
        INTERVENCAO_URBANA: '3CB',
        LIVRO_DE_ARTISTA: '3CC',
        OUTRA: '3CZ',
        PERFORMANCE: '3CD',
        PINTURA: '3CE',
        PROGRAMACAO_VISUAL: '3CF',
        VIDEO: '3CG',
        WEBART: '3CH',
      }),
    },
  },
);

/** A natureza é texto livre (f_natureza, 100); a cidade do evento é a CIDADE. */
const OUTRA_ARTISTICA = arte(
  'OU',
  'OUTRA-PRODUCAO-ARTISTICA-CULTURAL',
  'DADOS-BASICOS-DE-OUTRA-PRODUCAO-ARTISTICA-CULTURAL',
  'DETALHAMENTO-DE-OUTRA-PRODUCAO-ARTISTICA-CULTURAL',
  {
    details: {
      CIDADE: 'f_cidade',
      'INSTITUICAO-PROMOTORA-DO-EVENTO': 'f_inst',
      'LOCAL-DO-EVENTO': 'f_local',
      PREMIACAO: 'f_premiacao',
    },
    extra: { NATUREZA: 'f_natureza' },
  },
);

export const ARTISTICA_TARGETS: ProductionTarget[] = [
  ARTES_CENICAS,
  MUSICA,
  ARTES_VISUAIS,
  OUTRA_ARTISTICA,
];
