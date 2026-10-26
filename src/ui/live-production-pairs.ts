// Instituição, curso e agência de orientações e bancas na interface.
// A especificação do conector determina as buscas disponíveis por natureza.

import { PRODUCTION_TARGETS } from '../bridge/production/targets/index.ts';
import { foldText } from '../model/fold-text.ts';
import { lattesSchema } from '../schema/lattes.ts';
import type { LivePairs } from './live-lists.ts';

/** O nível do curso segue a natureza; o conector refaz a busca antes de gravar. */
export function productionPairs(element: string): LivePairs | undefined {
  const target = PRODUCTION_TARGETS.find((t) => t.lookups?.child === element);
  const spec = target?.lookups;
  if (!spec) return undefined;
  const natures = target.nature?.values ?? [];
  const nature = natures.length === 1 ? natures[0]! : undefined;
  const level = nature ? spec.course?.level[nature] : undefined;
  const c = spec.course;
  const byNature =
    c?.natures && natures.length > 1
      ? Object.fromEntries(
          Object.entries(c.natures).flatMap(([xml, code]) =>
            c.level[code]
              ? [
                  [
                    foldText(xml),
                    { level: c.level[code], staArea: c.noArea.includes(code) ? 'N' : '' } as const,
                  ],
                ]
              : [],
          ),
        )
      : undefined;
  return {
    ...(spec.agency
      ? {
          agency: {
            ...spec.agency,
            ...(lattesSchema.elements[element]?.attributes.some((a) => a.name === 'FLAG-BOLSA')
              ? { flag: 'FLAG-BOLSA' }
              : {}),
          },
        }
      : {}),
    ...(spec.course && nature && level
      ? {
          course: {
            code: spec.course.code,
            level,
            name: spec.course.name,
            program: 'TESE' as const,
            staArea: spec.course.noArea.includes(nature) ? ('N' as const) : ('' as const),
          },
        }
      : {}),
    ...(c && byNature
      ? {
          course: {
            byNature,
            code: c.code,
            level: '',
            name: c.name,
            program: 'TESE' as const,
            staArea: '' as const,
          },
        }
      : {}),
    institution: spec.institution,
    production: true,
    searchLevel: (nature && spec.institutionLevel?.[nature]) ?? '',
  };
}
