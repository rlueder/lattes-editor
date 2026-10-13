// Faixa de estados no cabeçalho (LAT-40): Original · alterações · no Lattes ·
// publicado. O passo que pede ação fica em destaque; as contagens abrem a
// lista correspondente. A regra de cada contagem está em status-strip.ts.

import { Fragment } from 'react';

import { Tip } from './primitives/Tip.tsx';
import { segmentLabel, type StripSegment, type StripState } from './status-strip.ts';
import { StorageBadge } from './StorageNotice.tsx';

const TIPS: Partial<Record<StripSegment['kind'], string>> = {
  alteracoes: 'Alterações no editor que ainda não foram ao Lattes. Abre "Levar ao Lattes".',
  'no-lattes':
    'Gravadas no Lattes e ainda não publicadas. O Lattes não descarta; para voltar atrás, desfaça antes de "Enviar ao CNPq". Abre o registro do enviado.',
  original: 'O currículo como veio da última exportação do Lattes.',
  'pendencia-desconhecida':
    'O Lattes tem alterações não enviadas ao CNPq que não passaram por este editor (feitas direto no Lattes ou em outro aparelho). Abre o diagnóstico.',
  publicado: 'Data da última publicação, lida do Lattes aberto no navegador.',
};

/** As contagens que abrem algo: a lista de alterações, o registro do enviado, o diagnóstico. */
export type StripOpenKind = 'alteracoes' | 'no-lattes' | 'pendencia-desconhecida';

export function StatusStrip({
  onOpen,
  state,
}: {
  state: StripState;
  onOpen: (kind: StripOpenKind) => void;
}) {
  if (state.segments.length === 0) return <StorageBadge />;
  return (
    <nav aria-label="Estado do currículo" className="status-strip">
      <StorageBadge />
      {state.segments.map((segment, i) => {
        const label = segmentLabel(segment);
        const tip = TIPS[segment.kind] ?? label;
        const className = `status-seg${state.action === segment.kind ? ' action' : ''}`;
        const kind = segment.kind;
        return (
          <Fragment key={kind}>
            {i > 0 && (
              <span aria-hidden="true" className="status-sep">
                ·
              </span>
            )}
            <Tip label={tip}>
              {kind === 'alteracoes' ||
              kind === 'no-lattes' ||
              kind === 'pendencia-desconhecida' ? (
                <button className={className} type="button" onClick={() => onOpen(kind)}>
                  {label}
                </button>
              ) : (
                <span className={className}>{label}</span>
              )}
            </Tip>
          </Fragment>
        );
      })}
    </nav>
  );
}
