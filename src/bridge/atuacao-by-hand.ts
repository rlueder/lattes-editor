// Por que uma alteração na atuação profissional fica à mão (LAT-58), quando o
// formulário do Lattes não tem o campo ou o conector não sabe montar o envio.
// O projeto, a equipe e os vínculos têm caminho próprio
// (production/targets/projetos.ts e plan.ts); aqui ficam os motivos do resto,
// para a pessoa saber o que fazer no Lattes.
//
// Fontes: seções 5, 6, 17, 18, 21 e 22 de docs/lattes_internals.md e o censo
// de 15/10/2026 (docs/lattes-formularios/).

import type { Change } from '../model/changes.ts';
import type { XElement } from '../model/xml.ts';

/** As naturezas de atividade de uma atuação (seção 17). */
const ACTIVITIES = new Set([
  'CONSELHO-COMISSAO-E-CONSULTORIA',
  'DIRECAO-E-ADMINISTRACAO',
  'ENSINO',
  'ESTAGIO',
  'EXTENSAO-UNIVERSITARIA',
  'OUTRA-ATIVIDADE-TECNICO-CIENTIFICA',
  'PESQUISA-E-DESENVOLVIMENTO',
  'SERVICO-TECNICO-ESPECIALIZADO',
  'TREINAMENTO-MINISTRADO',
]);

/**
 * A tela de cargos e vínculos (PKG_ATIV.cargos_vinculos) só leva aos
 * vínculos, às atividades e à exclusão da atuação; o formulário GN_ATIV é só
 * de inclusão (seção 17, observado).
 */
const ATUACAO =
  'A tela da atuação do Lattes não tem: a instituição (só leva aos vínculos, às atividades e à exclusão). Inclua no Lattes a atuação com a outra instituição e exclua esta';

/**
 * A alteração de uma atividade vai pelo conector (edit-atividade.ts; o
 * formulário GN_ATIV_CARGO e a grade de descrições f_espec_l estão em
 * docs/lattes_internals.md, seção 17, lidos em 19/10/2026) quando
 * EDIT_ATIVIDADES_ENABLED está ligada. O que chega aqui é o que ela não
 * trata: um envio sem a grade apagaria cargos, disciplinas e linhas de
 * pesquisa, então fica à mão.
 */
const ACTIVITY =
  'Alterar esta atividade da atuação vai à mão: para esta alteração o conector não monta a grade de cargos, disciplinas ou linhas de pesquisa dela, e um envio sem a grade as apagaria';

/** Seções 18 e 21: a chave r da grade de áreas não foi lida, nem como a página monta uma área nova. */
const AREA =
  'Alterar área de atuação vai à mão: a grade de áreas do Lattes (f_area_l) tem a chave r, de sentido não lido';

/** Os campos da participação que dizem o órgão ou a unidade. */
const ORGAO = new Set(['CODIGO-ORGAO', 'CODIGO-UNIDADE', 'NOME-ORGAO', 'NOME-UNIDADE']);

/**
 * Seção 21 ("Órgão e unidade do projeto"): o Lattes recebe o órgão novo pelo
 * formulário de alteração do projeto e mantém o de antes, pelo conector
 * (18/10/2026) e pela própria página (27/10/2026). Fica só para ler.
 */
const PARTICIPATION_ORGAO =
  'O Lattes não troca o órgão de um projeto que já existe: a própria página dele aceita a troca e mantém o de antes. Para outro órgão, inclua o projeto de novo';

/** O formulário de projeto (GN_PROJETO) tem só os anos do próprio projeto (seção 17). */
export const PARTICIPATION_PERIOD =
  'O formulário de projeto do Lattes não tem o período da sua participação, só o ano de início e de fim do projeto';

/** O motivo de uma alteração da atuação ficar à mão; undefined se não é destas. */
export function atuacaoByHand(change: Change, chain: readonly XElement[]): string | undefined {
  if (change.element === 'ATUACAO-PROFISSIONAL') {
    return change.fields.some((f) => f.attr.endsWith('-INSTITUICAO'))
      ? ATUACAO
      : `A tela da atuação no Lattes não tem: ${change.fields.map((f) => f.label).join(', ')}`;
  }
  if (change.element === 'AREA-DE-ATUACAO') return AREA;
  if (change.element === 'PARTICIPACAO-EM-PROJETO') {
    return change.fields.some((f) => ORGAO.has(f.attr))
      ? PARTICIPATION_ORGAO
      : PARTICIPATION_PERIOD;
  }
  if (chain.some((el) => ACTIVITIES.has(el.name)) || ACTIVITIES.has(change.element)) {
    return ACTIVITY;
  }
  return undefined;
}

/**
 * Os campos do vínculo que o formulário GN_ATIV_VINC não altera. O tipo vem
 * num campo desabilitado (f_vinc, seção 6, observado em 11/10/2026), e o
 * enquadramento só como texto livre (f_enqua guarda o "outro
 * enquadramento", ligação observada no censo de 15/10/2026).
 */
const VINCULO_BY_HAND: Record<string, string> = {
  'ENQUADRAMENTO-FUNCIONAL':
    'O formulário de vínculo do Lattes não tem o enquadramento da lista, só o texto livre (Outro enquadramento)',
  'OUTRO-VINCULO-INFORMADO':
    'O formulário de vínculo do Lattes não tem: o tipo do vínculo (vem desabilitado e não se altera por ali)',
  'TIPO-DE-VINCULO':
    'O formulário de vínculo do Lattes não tem: o tipo do vínculo (vem desabilitado e não se altera por ali)',
};

/** O motivo de uma alteração de vínculo ficar à mão; undefined se todos os campos vão. */
export function vinculoByHand(change: Change): string | undefined {
  const reasons = [
    ...new Set(change.fields.map((f) => VINCULO_BY_HAND[f.attr]).filter(Boolean)),
  ] as string[];
  return reasons.length > 0 ? reasons.join('; ') : undefined;
}
