// Os passos da janela "Enviar ao Lattes" (ExportPanel): ① revisar, ② gravar
// no Lattes, ③ publicar no CNPq, um embaixo do outro e sem modal por cima.
// Antes, um envio abria a confirmação, depois a pergunta do ponto de
// restauração, depois a pausa, e o envio ao CNPq era outro modal; a pessoa
// não sabia em que ponto estava (teste acompanhado de 16/10/2026). Aqui o
// andamento de cada alteração fica no lugar, e o que antes era pergunta em
// modal vira uma linha com os botões ao lado.

import { type ReactNode, useEffect, useRef } from 'react';

import { doneText, latestText, noRestoreText, stopText } from '../bridge/restore-point.ts';
import { pauseText } from '../bridge/write-brake.ts';
import type { BridgeState } from '../ui/use-bridge.ts';
import { type StepState, writeRows } from './send-steps.ts';

const MARK: Record<string, string> = {
  conferido: '✓',
  divergente: '!',
  erro: '!',
  fila: '○',
  gravando: '⟳',
  parada: '–',
  sessao: '!',
};

/** Os três passos no alto, com o atual marcado. */
export function StepHeader({ steps }: { steps: StepState[] }) {
  const labels = ['Revisar', 'Gravar no Lattes', 'Publicar no CNPq'];
  return (
    <ol aria-label="Passos do envio" className="send-steps">
      {labels.map((label, i) => (
        <li
          key={label}
          aria-current={steps[i] === 'atual' ? 'step' : undefined}
          className={`send-step ${steps[i]}`}
        >
          <span className="send-step-n">{steps[i] === 'feito' ? '✓' : i + 1}</span>
          {label}
        </li>
      ))}
    </ol>
  );
}

/** Um passo da janela: título numerado e o conteúdo; travado, só o motivo. */
export function Step({
  children,
  locked,
  n,
  title,
}: {
  children: ReactNode;
  locked?: string;
  n: number;
  title: string;
}) {
  return (
    <section className={`panel-section send-step-body${locked ? ' locked' : ''}`}>
      <h3 className="panel-section-head">
        {n}. {title}
      </h3>
      {locked ? <p className="muted">{locked}</p> : children}
    </section>
  );
}

/** ② Gravar no Lattes: a cópia antes, o andamento de cada alteração, a pausa. */
export function WriteStep({ bridge }: { bridge: BridgeState }) {
  const { restore } = bridge;
  const dismiss = useRef(bridge.dismissRestore);
  dismiss.current = bridge.dismissRestore;
  // A janela fechou com a cópia ainda sendo feita ou com a pergunta aberta:
  // vale como cancelar, nada é gravado e o aviso não volta ao reabrir.
  useEffect(() => () => dismiss.current(), []);
  const rows = writeRows(bridge.round ?? [], bridge.results, bridge.running, !!bridge.pause);
  return (
    <>
      {restore?.kind === 'fazendo' && (
        <p className="muted" role="status">
          Guardando uma cópia do Lattes como está, antes de gravar…
        </p>
      )}
      {restore?.kind === 'sem-ponto' && (
        <div className="step-notice warn" role="alert">
          <p>{noRestoreText(restore)}</p>
          <p>{latestText(restore.latest)}</p>
          <div className="step-actions">
            <button type="button" onClick={() => bridge.answerRestore(false)}>
              Cancelar
            </button>
            <button className="danger" type="button" onClick={() => bridge.answerRestore(true)}>
              Gravar sem ponto de restauração
            </button>
          </div>
        </div>
      )}
      {restore?.kind === 'parar' && (
        <div className="step-notice warn" role="alert">
          <p>{stopText(restore)}</p>
          <div className="step-actions">
            <button type="button" onClick={() => bridge.answerRestore(false)}>
              Entendi
            </button>
          </div>
        </div>
      )}
      {restore?.kind === 'feito' && <p className="muted">{doneText(restore)}</p>}

      {rows.length > 0 && (
        <ul className="write-rows">
          {rows.map((row) => (
            <li key={row.key} className={`write-row ${row.state}`}>
              <span aria-hidden="true" className="write-mark">
                {MARK[row.state]}
              </span>
              <span className="write-label">{row.label}</span>
              <span className="write-state">{row.text}</span>
              {row.detail && <span className="write-detail">{row.detail}</span>}
            </li>
          ))}
        </ul>
      )}

      {bridge.pause && !bridge.running && (
        <div className="step-notice" role="status">
          <p>{pauseText(bridge.pause, 'aqui')}</p>
          <div className="step-actions">
            <button className="primary" type="button" onClick={bridge.resume}>
              Continuar
            </button>
          </div>
        </div>
      )}
      {bridge.running && (
        <div className="step-actions">
          <span className="muted">Deixe a aba do Lattes aberta.</span>
          <button type="button" onClick={bridge.stop}>
            Parar
          </button>
        </div>
      )}
    </>
  );
}
