// Os passos da janela "Enviar ao Lattes" (ExportPanel): ① revisar, ② gravar
// no Lattes, ③ publicar no CNPq, um embaixo do outro e sem modal por cima.
// Antes, um envio abria a confirmação, depois a pergunta do ponto de
// restauração, depois a pausa, e o envio ao CNPq era outro modal; a pessoa
// não sabia em que ponto estava (teste acompanhado de 16/10/2026). Aqui o
// andamento de cada alteração fica no lugar, e o que antes era pergunta em
// modal vira uma linha com os botões ao lado.

import type { ReactNode } from 'react';

import { doneText, latestText, noRestoreText, stopText } from '../bridge/restore-point.ts';
import { pauseText } from '../bridge/write-brake.ts';
import { AlertIcon, CheckIcon } from '../ui/icons.tsx';
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

/**
 * Os três passos no alto, com o atual marcado e o que está à vista
 * destacado. Um passo feito (ou o atual) abre pelo clique; o que vem depois
 * ainda não.
 */
export function StepHeader({
  onSelect,
  shown,
  steps,
}: {
  shown: number;
  steps: StepState[];
  onSelect: (step: number) => void;
}) {
  const labels = ['Revisar', 'Gravar no Lattes', 'Publicar no CNPq'];
  return (
    <ol aria-label="Passos do envio" className="send-steps">
      {labels.map((label, i) => (
        <li key={label}>
          <button
            aria-current={i === shown ? 'step' : undefined}
            className={`send-step ${steps[i]}${i === shown ? ' shown' : ''}`}
            disabled={steps[i] === 'depois'}
            type="button"
            onClick={() => onSelect(i)}
          >
            <span className="send-step-n">{steps[i] === 'feito' ? '✓' : i + 1}</span>
            {label}
          </button>
        </li>
      ))}
    </ol>
  );
}

/** O conteúdo de um passo; travado, só o motivo. O nome dele já está na pílula. */
export function Step({
  children,
  locked,
  title,
}: {
  children: ReactNode;
  locked?: string;
  title: string;
}) {
  return (
    <section aria-label={title} className="panel-section send-step-body">
      {locked ? <p className="muted">{locked}</p> : children}
    </section>
  );
}

/**
 * Um aviso da janela de envio numa linha: o ícone, o texto e os botões à
 * direita, alinhados ao centro. warn é o amarelo do que pede atenção, ok o
 * verde do que deu certo; sem os dois, o azul do que só informa.
 */
export function Notice({
  actions,
  children,
  ok,
  role = 'status',
  warn,
}: {
  actions?: ReactNode;
  children: ReactNode;
  /** O verde do que deu certo, com a marca de conferido. */
  ok?: boolean;
  role?: 'alert' | 'group' | 'status';
  warn?: boolean;
}) {
  return (
    <div className={`step-notice${warn ? ' warn' : ok ? ' ok' : ''}`} role={role}>
      {(warn || ok) && (
        <span className="step-notice-icon">{warn ? <AlertIcon /> : <CheckIcon />}</span>
      )}
      <div className="step-notice-text">{children}</div>
      {actions && <div className="step-notice-actions">{actions}</div>}
    </div>
  );
}

/** ② Gravar no Lattes: a cópia antes, o andamento de cada alteração, a pausa. */
export function WriteStep({ bridge }: { bridge: BridgeState }) {
  const { restore } = bridge;
  const rows = writeRows(bridge.round ?? [], bridge.results, bridge.running, !!bridge.pause);
  return (
    <>
      {restore?.kind === 'fazendo' && (
        <p className="muted" role="status">
          Guardando uma cópia do Lattes como está, antes de gravar…
        </p>
      )}
      {restore?.kind === 'sem-ponto' && (
        <Notice
          warn
          actions={
            <>
              <button type="button" onClick={() => bridge.answerRestore(false)}>
                Cancelar
              </button>
              <button className="danger" type="button" onClick={() => bridge.answerRestore(true)}>
                Gravar sem a cópia de antes
              </button>
            </>
          }
          role="alert"
        >
          <p>{noRestoreText(restore)}</p>
          <p>{latestText(restore.latest)}</p>
        </Notice>
      )}
      {restore?.kind === 'parar' && (
        <Notice
          warn
          actions={
            <button type="button" onClick={() => bridge.answerRestore(false)}>
              Entendi
            </button>
          }
          role="alert"
        >
          <p>{stopText(restore)}</p>
        </Notice>
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
        <Notice
          actions={
            <button className="primary" type="button" onClick={bridge.resume}>
              Continuar
            </button>
          }
        >
          <p>{pauseText(bridge.pause, 'aqui')}</p>
        </Notice>
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
