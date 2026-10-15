import { describe, expect, it } from 'vitest';

import { OBSERVED_LANGUAGE, PUBLISH_ENABLED } from '../src/bridge/publish.ts';
import {
  checksLine,
  initialForm,
  PUBLISH_REPLY_TIMEOUT_MS,
  publishRequest,
  publishStatus,
  publishUiEnabled,
  sendScreenProblem,
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
    // Sem os controles na tela: o que foi observado no envio pelo Lattes.
    expect(initialForm({ declaration: 'Declaro…' })).toEqual({
      emailAlternative: '',
      emailContact: '',
      english: true,
      language: OBSERVED_LANGUAGE,
    });
    expect(initialForm(undefined).language).toBe(OBSERVED_LANGUAGE);
    // Com a lista de idiomas e nenhum marcado, a pessoa escolhe.
    expect(
      initialForm({ declaration: 'D', language: { options: [{ label: 'P', value: '1' }] } })
        .language,
    ).toBe('');
    expect(publishRequest(form, false).declarationAccepted).toBe(false);
    expect(publishRequest(form, true).declarationAccepted).toBe(true);
  });

  it('o estado do envio: esperando, respondido, publicado e sem resposta', () => {
    expect(publishStatus(undefined, undefined, 0)).toEqual({ busy: false, done: false });
    const attempt = { at: 1000, id: 'p1' };
    expect(publishStatus(attempt, undefined, 2000)).toMatchObject({ busy: true, done: false });
    const other = { at: 3000, id: 'p0', result: { outcome: 'publicado' as const } };
    expect(publishStatus(attempt, other, 3000).busy).toBe(true);
    const done = { at: 3000, id: 'p1', result: { outcome: 'publicado' as const } };
    expect(publishStatus(attempt, done, 3000)).toMatchObject({ busy: false, done: true });
    const refused = { at: 3000, id: 'p1', result: { detail: 'x', outcome: 'email' as const } };
    expect(publishStatus(attempt, refused, 3000)).toEqual({ busy: false, done: false, text: 'x' });
    expect(publishStatus(attempt, undefined, 1000 + PUBLISH_REPLY_TIMEOUT_MS)).toMatchObject({
      busy: false,
      done: false,
    });
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

  it('o envio pelo editor fica desligado, menos com ?publicar em desenvolvimento', () => {
    expect(PUBLISH_ENABLED).toBe(false);
    expect(publishUiEnabled('', true)).toBe(false);
    expect(publishUiEnabled('?publicar', false)).toBe(false);
    expect(publishUiEnabled('?exemplo=demo&publicar', true)).toBe(true);
  });

  it('a linha da conferência', () => {
    expect(checksLine(0)).toMatch(/não achou/);
    expect(checksLine(1)).toMatch(/1 ponto/);
    expect(checksLine(3)).toMatch(/3 pontos/);
  });
});
