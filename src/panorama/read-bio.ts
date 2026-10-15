// Leitura da parte biográfica para o Panorama: formação, vínculos, projetos
// e prêmios, com os anos de início e fim.

import { elementLabel } from '../labels/labels.ts';
import { childElements, type XElement } from '../model/xml.ts';
import type { Award, Degree, Position, Project, SelfTest } from './model.ts';
import { attr, descendants, yearNum } from './read-helpers.ts';

export function readDegrees(root: XElement): Degree[] {
  const box = descendants(root, (el) => el.name === 'FORMACAO-ACADEMICA-TITULACAO');
  return box.flatMap((b) =>
    childElements(b).map((el) => {
      const start = yearNum(attr(el, 'ANO-DE-INICIO'));
      const end =
        yearNum(attr(el, 'ANO-DE-CONCLUSAO')) ?? yearNum(attr(el, 'ANO-DE-OBTENCAO-DO-TITULO'));
      const course = attr(el, 'NOME-CURSO');
      return {
        advisor: attr(el, 'NOME-COMPLETO-DO-ORIENTADOR') || attr(el, 'NOME-DO-ORIENTADOR'),
        el,
        end,
        inst: attr(el, 'NOME-INSTITUICAO'),
        kind: 'formacao' as const,
        level: el.name,
        sectionId: 'formacao',
        start,
        title: course ? `${elementLabel(el.name)} em ${course}` : elementLabel(el.name),
        typeLabel: elementLabel(el.name),
        year: end ?? start,
      };
    }),
  );
}

export function readPositions(root: XElement): Position[] {
  return descendants(root, (el) => el.name === 'ATUACAO-PROFISSIONAL').flatMap((ap) =>
    childElements(ap, 'VINCULOS').map((v) => {
      const start = yearNum(attr(v, 'ANO-INICIO'));
      return {
        el: v,
        end: yearNum(attr(v, 'ANO-FIM')),
        inst: attr(ap, 'NOME-INSTITUICAO'),
        kind: 'vinculo' as const,
        sectionId: 'atuacao',
        start,
        title:
          attr(v, 'OUTRO-ENQUADRAMENTO-FUNCIONAL-INFORMADO') ||
          attr(v, 'OUTRO-VINCULO-INFORMADO') ||
          elementLabel('VINCULOS'),
        typeLabel: elementLabel('VINCULOS'),
        year: start,
      };
    }),
  );
}

export function readProjects(root: XElement, isSelf: SelfTest): Project[] {
  return descendants(root, (el) => el.name === 'PROJETO-DE-PESQUISA').map((p) => {
    const team = descendants(p, (el) => el.name === 'INTEGRANTES-DO-PROJETO').map((m) => ({
      cit: attr(m, 'NOME-PARA-CITACAO'),
      full: attr(m, 'NOME-COMPLETO'),
      lead: attr(m, 'FLAG-RESPONSAVEL') === 'SIM',
    }));
    const start = yearNum(attr(p, 'ANO-INICIO'));
    return {
      el: p,
      end: yearNum(attr(p, 'ANO-FIM')),
      inst: '',
      kind: 'projeto' as const,
      lead: team.some((m) => m.lead && isSelf(m.full, m.cit)),
      sectionId: 'projetos',
      start,
      team: team.map(({ cit, full }) => ({ cit, full })),
      title: attr(p, 'NOME-DO-PROJETO'),
      typeLabel: elementLabel(p.name),
      year: start,
    };
  });
}

export function readAwards(root: XElement): Award[] {
  return descendants(root, (el) => el.name === 'PREMIO-TITULO').map((p) => ({
    el: p,
    inst: attr(p, 'NOME-DA-ENTIDADE-PROMOTORA'),
    kind: 'premio' as const,
    sectionId: 'dados-gerais',
    title: attr(p, 'NOME-DO-PREMIO-OU-TITULO'),
    typeLabel: elementLabel(p.name),
    year: yearNum(attr(p, 'ANO-DA-PREMIACAO')),
  }));
}
