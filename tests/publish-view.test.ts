import { describe, expect, it } from 'vitest';

import { PUBLISH_ENABLED } from '../src/bridge/publish.ts';
import {
  canReadSendScreen,
  canSendCv,
  checksLine,
  initialForm,
  locksSending,
  PUBLISH_REPLY_TIMEOUT_MS,
  publishRequest,
  publishStatus,
  publishUiEnabled,
  SCREEN_TIMEOUT_MS,
  sendScreenProblem,
  sendScreenStatus,
} from '../src/import-export/publish-view.ts';

describe('painel Enviar ao CNPq (LAT-54)', () => {
  it('o formulário começa com o que a tela do Lattes tem, e a declaração nunca vem dele', () => {
    const form = initialForm({
      declaration: 'Declaro…',
      emailAlternative: 'b@example.org',
      emailContact: 'a@example.org',
      english: { checked: true, label: 'Autorizo', value: '1' },
      language: { options: [{ label: 'Português', value: '1' }], selected: '1' },
    });
    expect(form).toEqual({
      emailAlternative: 'b@example.org',
      emailContact: 'a@example.org',
      english: true,
      language: '1',
    });
    expect('declarationAccepted' in form).toBe(false);
    // Sem os controles na tela, nada é presumido (e o envio é recusado).
    expect(initialForm({ declaration: 'Declaro…' })).toEqual({
      emailAlternative: '',
      emailContact: '',
      english: false,
      language: '',
    });
    expect(initialForm(undefined).english).toBe(false);
    // Com a lista de idiomas e nenhum marcado, a pessoa escolhe.
    expect(
      initialForm({ declaration: 'D', language: { options: [{ label: 'P', value: '1' }] } })
        .language,
    ).toBe('');
    expect(publishRequest(form, false, 'D').declarationAccepted).toBe(false);
    expect(publishRequest(form, true, 'D')).toMatchObject({
      declarationAccepted: true,
      declarationText: 'D',
    });
  });

  it('o estado do envio: esperando, respondido, publicado e sem resposta', () => {
    expect(publishStatus(undefined, undefined, 0)).toEqual({
      busy: false,
      done: false,
      locked: false,
    });
    const attempt = { at: 1000, id: 'p1' };
    expect(publishStatus(attempt, undefined, 2000)).toMatchObject({ busy: true, done: false });
    // O tempo corrido, para quem espera ver que o envio segue.
    expect(publishStatus(attempt, undefined, attempt.at + 65_000).text).toMatch(/\(65 s\)/);
    const other = { at: 3000, id: 'p0', result: { outcome: 'publicado' as const } };
    expect(publishStatus(attempt, other, 3000).busy).toBe(true);
    const done = { at: 3000, id: 'p1', result: { outcome: 'publicado' as const } };
    expect(publishStatus(attempt, done, 3000)).toMatchObject({ busy: false, done: true });
    const refused = { at: 3000, id: 'p1', result: { detail: 'x', outcome: 'email' as const } };
    // Recusado antes de sair: dá para corrigir e enviar de novo no mesmo painel.
    expect(publishStatus(attempt, refused, 3000)).toEqual({
      busy: false,
      done: false,
      locked: false,
      text: 'x',
    });
    // Sem resposta no prazo: pode ter saído, o botão trava até reabrir.
    expect(publishStatus(attempt, undefined, 1000 + PUBLISH_REPLY_TIMEOUT_MS)).toMatchObject({
      busy: false,
      done: false,
      locked: true,
    });
    const unsure = {
      at: 3000,
      id: 'p1',
      result: { outcome: 'nao-confirmado' as const, sent: true },
    };
    expect(publishStatus(attempt, unsure, 3000)).toMatchObject({ locked: true });
    expect(publishStatus(attempt, unsure, 3000).text).toMatch(/feche e abra este painel/);
  });

  it('o que trava o botão: tudo que pode ter saído para o Lattes', () => {
    expect(locksSending({ outcome: 'publicado', sent: true })).toBe(true);
    expect(locksSending({ outcome: 'sessao', sent: true })).toBe(true);
    // O erro da aba no meio do envio não diz se saiu.
    expect(locksSending({ outcome: 'erro' })).toBe(true);
    for (const outcome of [
      'declaracao',
      'mudou',
      'nada-a-publicar',
      'email',
      'raca-cor',
    ] as const) {
      expect(locksSending({ outcome })).toBe(false);
    }
  });

  it('a leitura da tela de envio: capacidade, espera, prazo e resposta', () => {
    expect(canReadSendScreen(['enviar-cnpq'])).toBe(true);
    expect(sendScreenStatus({ features: [], now: 0 }).problem).toMatch(/Atualize a extensão/);
    const features = ['enviar-cnpq'];
    expect(sendScreenStatus({ features, now: 0 })).toEqual({ waiting: false });
    expect(sendScreenStatus({ features, now: 10, requestedAt: 0 })).toEqual({ waiting: true });
    expect(sendScreenStatus({ features, now: SCREEN_TIMEOUT_MS, requestedAt: 0 }).problem).toMatch(
      /não respondeu/,
    );
    expect(
      sendScreenStatus({ features, now: 10, reading: { reason: 'sem-aba' }, requestedAt: 0 }),
    ).toMatchObject({ waiting: false });
    expect(sendScreenProblem({ detail: 'Falta o idioma.', reason: 'mudou' })).toBe(
      'Falta o idioma. Envie pelo Lattes.',
    );
  });

  it('por que a tela de envio não veio', () => {
    expect(sendScreenProblem(undefined)).toBeUndefined();
    expect(sendScreenProblem({})).toBeUndefined();
    for (const reason of ['consentimento', 'sem-aba', 'sessao', 'ocupado', 'mudou'] as const) {
      expect(sendScreenProblem({ reason })).toBeTruthy();
    }
    expect(sendScreenProblem({ detail: 'outro', reason: 'outro-cv' })).toBe('outro');
    expect(sendScreenProblem({ reason: 'erro' })).toMatch(/não conseguiu/);
  });

  it('o envio pelo editor está disponível sem parâmetro de desenvolvimento', () => {
    expect(PUBLISH_ENABLED).toBe(true);
    expect(publishUiEnabled('', false)).toBe(true);
    expect(publishUiEnabled('', true)).toBe(true);
    expect(publishUiEnabled('?publicar', false)).toBe(true);
    expect(publishUiEnabled('?exemplo=demo&publicar', true)).toBe(true);
    expect(canSendCv(['enviar-cnpq'])).toBe(false);
    expect(canSendCv(['enviar-cnpq', 'publicar-cnpq'])).toBe(true);
    expect(canSendCv([])).toBe(false);
  });

  it('a linha da conferência', () => {
    expect(checksLine(0)).toMatch(/não achou/);
    expect(checksLine(1)).toMatch(/1 ponto/);
    expect(checksLine(3)).toMatch(/3 pontos/);
  });
});
