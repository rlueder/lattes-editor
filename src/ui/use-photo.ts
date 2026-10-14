// Carrega a foto do perfil com novas tentativas (photo-retry.ts) e diz quando
// ela chegou, para o avatar mostrar as iniciais até lá em vez de um círculo vazio.

import { useEffect, useReducer } from 'react';

import {
  attemptUrl,
  initialPhotoState,
  PHOTO_TIMEOUT_MS,
  photoReducer,
  retryDelay,
} from './photo-retry.ts';

export interface PhotoLoad {
  loaded: boolean;
  /** O endereço da tentativa atual; undefined sem foto ou depois da última falha. */
  src?: string;
  onError: () => void;
  onLoad: () => void;
}

export function usePhoto(base: string | undefined): PhotoLoad {
  const [stored, dispatch] = useReducer(photoReducer, base, initialPhotoState);
  // Outra foto (outro currículo, ou a mesma trocada) começa do zero já neste
  // render, sem passar por um render com a tentativa da foto anterior (que
  // pediria um endereço à toa).
  if (stored.base !== base) dispatch({ base, type: 'reset' });
  const state = stored.base === base ? stored : initialPhotoState(base);
  const { attempt, failures, status } = state;

  // Os relógios vivem nos efeitos: mudou a tentativa ou o estado, o anterior
  // é cancelado na limpeza do efeito.
  useEffect(() => {
    if (!base) return;
    if (status === 'loading') {
      // Tentativa sem resposta também conta como falha.
      const t = setTimeout(() => dispatch({ attempt, base, type: 'fail' }), PHOTO_TIMEOUT_MS);
      return () => clearTimeout(t);
    }
    if (status === 'waiting') {
      const t = setTimeout(() => dispatch({ attempt, base, type: 'retry' }), retryDelay(failures));
      return () => clearTimeout(t);
    }
    if (status === 'gave-up') {
      // Depois da última falha, a rede que volta ou a janela que volta ao foco
      // abrem uma nova rodada.
      const again = () => dispatch({ base, type: 'wake' });
      window.addEventListener('online', again);
      window.addEventListener('focus', again);
      return () => {
        window.removeEventListener('online', again);
        window.removeEventListener('focus', again);
      };
    }
    return undefined;
  }, [base, attempt, failures, status]);

  return {
    loaded: status === 'loaded',
    onError: () => dispatch({ attempt, base, type: 'fail' }),
    onLoad: () => dispatch({ attempt, base, type: 'load' }),
    src: base && status !== 'gave-up' ? attemptUrl(base, attempt) : undefined,
  };
}
