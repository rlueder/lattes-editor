// Envio pela extensão, dentro de "Levar ao Lattes". O próprio botão mostra o
// estado: enviar, parar enquanto a fila corre, e conferido (verde, com o
// visto) quando tudo foi gravado e lido de volta. O que foi conferido sai da
// lista de alterações, porque o Lattes já está igual à cópia de trabalho.

import { useState } from 'react';

import type { ResultStatus } from '../bridge/apply.ts';
import { CheckIcon, UploadIcon } from '../ui/icons.tsx';
import type { BridgeState } from '../ui/use-bridge.ts';
import { SendConfirm } from './SendConfirm.tsx';

const STATUS: Record<Exclude<ResultStatus, 'conferido'>, string> = {
  divergente: 'o Lattes está diferente do esperado',
  erro: 'erro',
  sessao: 'a sessão do Lattes caiu',
};

export function BridgeBlock({ bridge }: { bridge: BridgeState }) {
  const { ops, unsupported } = bridge.plan;
  // Nada vai ao Lattes sem a pessoa ver a fila inteira e confirmar.
  const [confirming, setConfirming] = useState(false);
  const failed = Object.values(bridge.results).filter((r) => r.status !== 'conferido');
  const allDone = ops.length === 0 && bridge.confirmed > 0 && failed.length === 0;
  if (!bridge.available || (ops.length === 0 && bridge.confirmed === 0)) return null;

  const plural = (n: number) => (n === 1 ? '1 alteração' : `${n} alterações`);
  return (
    <div className={`bridge-block${allDone ? ' done' : ''}`}>
      <div className="bridge-head">
        <p>
          {allDone
            ? `${plural(bridge.confirmed)} ${bridge.confirmed === 1 ? 'gravada e conferida' : 'gravadas e conferidas'} no Lattes.`
            : `A extensão pode levar ${plural(ops.length)} direto ao Lattes, conferindo cada uma.`}
          {!allDone &&
            unsupported.length > 0 &&
            ` ${unsupported.length === 1 ? '1 fica' : `${unsupported.length} ficam`} para copiar à mão.`}
        </p>
        {allDone ? (
          <button disabled className="bridge-btn ok" type="button">
            <CheckIcon /> Conferido
          </button>
        ) : bridge.running ? (
          <button className="bridge-btn" type="button" onClick={bridge.stop}>
            Parar
          </button>
        ) : (
          <button className="bridge-btn primary" type="button" onClick={() => setConfirming(true)}>
            <UploadIcon /> Enviar pela extensão
          </button>
        )}
      </div>
      {bridge.running && (
        <p className="muted bridge-note">
          A fila está no painel da extensão: clique no ícone dela e em &quot;Aplicar todas&quot;.
        </p>
      )}
      {failed.length > 0 && (
        <ul className="bridge-results">
          {failed.map((r) => (
            <li key={r.key} className={`bridge-result ${r.status}`}>
              <span>{ops.find((op) => op.key === r.key)?.label ?? r.key}</span>
              <span>
                {STATUS[r.status as Exclude<ResultStatus, 'conferido'>]}: {r.detail}
              </span>
            </li>
          ))}
        </ul>
      )}
      <SendConfirm
        open={confirming}
        ops={ops}
        onCancel={() => setConfirming(false)}
        onSend={() => {
          setConfirming(false);
          void bridge.send();
        }}
      />
    </div>
  );
}
