// Carrega a foto do perfil com novas tentativas (photo-retry.ts) e diz quando
// ela chegou, para o avatar mostrar as iniciais até lá em vez de um círculo vazio.

import { useCallback, useEffect, useRef, useState } from 'react';

import { attemptUrl, PHOTO_TIMEOUT_MS, retryDelay } from './photo-retry.ts';

export interface PhotoLoad {
  loaded: boolean;
  /** O endereço da tentativa atual; undefined sem foto ou depois da última falha. */
  src?: string;
  onError: () => void;
  onLoad: () => void;
}

export function usePhoto(base: string | undefined): PhotoLoad {
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [gaveUp, setGaveUp] = useState(false);
  const failures = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Outra foto (outro currículo, ou a mesma trocada): começa do zero.
  useEffect(() => {
    failures.current = 0;
    setAttempt(0);
    setLoaded(false);
    setGaveUp(false);
  }, [base]);

  const fail = useCallback(() => {
    clearTimeout(timer.current);
    // A foto some (as iniciais aparecem) até uma nova tentativa chegar.
    setLoaded(false);
    failures.current += 1;
    const delay = retryDelay(failures.current);
    if (delay === undefined) {
      setGaveUp(true);
      return;
    }
    timer.current = setTimeout(() => setAttempt((a) => a + 1), delay);
  }, []);

  // Tentativa sem resposta também conta como falha.
  useEffect(() => {
    if (!base || loaded || gaveUp) return;
    const t = setTimeout(fail, PHOTO_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [base, attempt, loaded, gaveUp, fail]);

  // Depois da última falha, a rede que volta ou a janela que volta ao foco
  // abrem uma nova rodada.
  useEffect(() => {
    if (!gaveUp) return;
    const again = () => {
      failures.current = 0;
      setGaveUp(false);
      setAttempt((a) => a + 1);
    };
    window.addEventListener('online', again);
    window.addEventListener('focus', again);
    return () => {
      window.removeEventListener('online', again);
      window.removeEventListener('focus', again);
    };
  }, [gaveUp]);

  useEffect(() => () => clearTimeout(timer.current), []);

  return {
    loaded,
    onError: fail,
    onLoad: () => {
      clearTimeout(timer.current);
      setLoaded(true);
    },
    src: base && !gaveUp ? attemptUrl(base, attempt) : undefined,
  };
}
