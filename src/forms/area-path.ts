import { enumLabel } from '../labels/labels.ts';
import type { KnowledgeArea } from '../model/production.ts';

/** "Desenho Industrial › Programação Visual", sem os níveis vazios. */
export function areaPath(a: KnowledgeArea): string {
  return [a.area, a.subArea, a.specialty].filter(Boolean).join(' › ') || enumLabel(a.bigArea);
}
