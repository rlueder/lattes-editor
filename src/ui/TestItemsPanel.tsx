// O painel dos itens de teste (só com ?itens-teste no endereço): cada botão
// pede uma ação à extensão Dev, que roda na aba do Lattes. Grava no
// currículo: só a pessoa clica (docs/lattes-formularios/itens-de-teste.md).

import { useState } from 'react';

import { liveLine, useTestItems } from './use-test-items.ts';

const LABEL = {
  andamento: 'Atualizando',
  criar: 'Criando um lote',
  preparar: 'Lendo os formulários (alguns minutos)',
  remover: 'Removendo um lote',
} as const;

export function TestItemsPanel() {
  const { ask, pending, state } = useTestItems();
  const [batch, setBatch] = useState(10);
  const s = state.summary;
  const last = state.log[0];
  return (
    <aside aria-label="Itens de teste" className="test-items-panel">
      <h2>Itens de teste (Dev)</h2>
      <p className="muted">
        {s
          ? `Criados ${s.criados ?? 0}${s.total ? ` de ${s.total}` : ''} · faltam ${s.faltam ?? '?'} · falharam ${s.falharam?.length ?? 0} · removidos ${s.removidos ?? 0}`
          : 'Comece por "Ler formulários".'}
      </p>
      {s && (
        <p className="muted">
          {s.base
            ? `Base das listas de ${new Date(s.base).toLocaleString('pt-BR')} · a mais que a base: ${s.registrados ?? 0}`
            : 'Sem base das listas: "Ler formulários" tira uma antes do primeiro item.'}
        </p>
      )}
      {s?.faltandoDaBase && s.faltandoDaBase.length > 0 && (
        <div className="test-items-error" role="alert">
          <p>Sumiram da base ({s.faltandoDaBase.length}). Confira no Lattes:</p>
          <ul>
            {s.faltandoDaBase.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>
      )}
      <label className="test-items-batch">
        Lote
        <input
          max={50}
          min={1}
          type="number"
          value={batch}
          onChange={(e) => setBatch(Math.max(1, Math.min(50, Number(e.target.value) || 1)))}
        />
      </label>
      <div className="test-items-actions">
        <button disabled={!!pending} type="button" onClick={() => ask('preparar')}>
          Ler formulários
        </button>
        <button
          className="primary"
          disabled={!!pending}
          type="button"
          onClick={() => ask('criar', { batch })}
        >
          Criar próximo lote
        </button>
        <button
          disabled={!!pending}
          type="button"
          onClick={() => ask('criar', { batch, retryFailed: true })}
        >
          Tentar de novo os que falharam
        </button>
        <button
          disabled={!!pending}
          type="button"
          onClick={() => ask('remover', { batch, dryRun: true })}
        >
          Ver o que sai
        </button>
        <button disabled={!!pending} type="button" onClick={() => ask('remover', { batch })}>
          Remover lote
        </button>
        <button disabled={!!pending} type="button" onClick={() => ask('andamento')}>
          Atualizar
        </button>
      </div>
      {pending && (
        <p role="status">
          {LABEL[pending]}… {liveLine(state.live)}
        </p>
      )}
      {last?.error && (
        <p className="test-items-error" role="alert">
          {last.error}
        </p>
      )}
      {s?.ensaio && (
        <details open>
          <summary>Sairiam ({s.ensaio.length})</summary>
          <ul>
            {s.ensaio.map((r, i) => (
              <li key={`${i}-${r}`}>{r}</li>
            ))}
          </ul>
        </details>
      )}
      {s?.semMarca && s.semMarca.length > 0 && (
        <div className="test-items-error" role="alert">
          <p>
            Sem a marca na página ({s.semMarca.length}): ficaram. Podem ser itens seus incluídos ou
            alterados depois da base. Confira cada um no Lattes antes de remover.
          </p>
          <ul>
            {s.semMarca.map((r, i) => (
              <li key={`${i}-${r}`}>{r}</li>
            ))}
          </ul>
          <button
            disabled={!!pending}
            type="button"
            onClick={() => ask('remover', { batch, unmarked: true })}
          >
            Remover também os sem marca
          </button>
        </div>
      )}
      {s?.falharam && s.falharam.length > 0 && (
        <details>
          <summary>Falharam ({s.falharam.length})</summary>
          <ul>
            {s.falharam.map((f) => (
              <li key={f.tag}>
                <strong>{f.tag}</strong>: {f.msgs.join(' ') || 'sem mensagem do Lattes'}
              </li>
            ))}
          </ul>
        </details>
      )}
    </aside>
  );
}
