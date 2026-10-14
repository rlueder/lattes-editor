// Carrega a foto do perfil com novas tentativas (photo-retry.ts) e diz quando
// ela chegou, para o avatar mostrar as iniciais até lá em vez de um círculo vazio.

import { useEffect, useReducer } from 'react';

import {
  focusWakes,
  initialPhotoState,
  PHOTO_TIMEOUT_MS,
  photoReducer,
  photoSrc,
  retryDelay,
} from './photo-retry.ts';

export interface PhotoLoad {
  loaded: boolean;
  /** O endereço em uso; undefined sem foto. */
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
      const t = setTimeout(
        () => dispatch({ attempt, base, reason: 'timeout', type: 'fail' }),
        PHOTO_TIMEOUT_MS,
      );
      return () => clearTimeout(t);
    }
    if (status === 'waiting') {
      const t = setTimeout(() => dispatch({ attempt, base, type: 'retry' }), retryDelay(failures));
      return () => clearTimeout(t);
    }
    if (status === 'gave-up') {
      // Depois da última falha, a rede que volta abre uma nova rodada; a janela
      // que volta ao foco também, se já faz um tempo (FOCUS_WAKE_MIN_MS).
      const gaveUpAt = Date.now();
      const again = () => dispatch({ base, type: 'wake' });
      const onFocus = () => {
        if (focusWakes(gaveUpAt, Date.now())) again();
      };
      window.addEventListener('online', again);
      window.addEventListener('focus', onFocus);
      return () => {
        window.removeEventListener('online', again);
        window.removeEventListener('focus', onFocus);
      };
    }
    return undefined;
  }, [base, attempt, failures, status]);

  return {
    loaded: status === 'loaded',
    onError: () => dispatch({ attempt, base, reason: 'error', type: 'fail' }),
    onLoad: () => dispatch({ attempt, base, type: 'load' }),
    src: photoSrc(state),
  };
}
