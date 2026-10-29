import { describe, expect, it } from 'vitest';

import { BRIDGE_FEATURES } from '../src/bridge/compat.ts';
import type { Link } from '../src/bridge/link.ts';
import type { OpenState } from '../src/ui/lattes-open.ts';
import { EXTENSION_URL } from '../src/ui/notifications.ts';
import { LATTES_URL, onboardingSteps } from '../src/ui/onboarding.ts';

const ALL = [...BRIDGE_FEATURES];
const parado: OpenState = { kind: 'parado' };
const v = '1.0.0';

const statuses = (link: Link, open: OpenState = parado) =>
  onboardingSteps(link, open).map((s) => s.status);

describe('primeiro uso: os três passos', () => {
  it('procurando a extensão: passo 1 andando, os outros esperando', () => {
    const [ext] = onboardingSteps({ state: { kind: 'procurando' } }, parado);
    expect(ext).toMatchObject({ busy: true, status: 'agora' });
    expect(statuses({ state: { kind: 'procurando' } })).toEqual(['agora', 'depois', 'depois']);
  });

  it('sem extensão: baixar, e o texto cobre o navegador fechado', () => {
    const [ext] = onboardingSteps({ state: { kind: 'sem-extensao' } }, parado);
    expect(ext?.action).toEqual({
      href: EXTENSION_URL,
      kind: 'link',
      label: 'Instalar da Chrome Web Store',
    });
    expect(EXTENSION_URL).toMatch(/^https:\/\/chromewebstore\.google\.com\/detail\//);
    expect(ext?.text).toMatch(/Se já instalou, abra o navegador/);
  });

  it('extensão antiga ou incompatível: atualizar', () => {
    for (const link of [
      { features: ['estado-lattes'], state: { kind: 'lendo' as const, version: '0.17.0' } },
      { state: { kind: 'incompativel' as const } },
    ]) {
      const [ext] = onboardingSteps(link, parado);
      expect(ext).toMatchObject({ status: 'agora', title: 'Atualize a extensão' });
      expect(ext?.action?.label).toBe('Atualizar na Chrome Web Store');
    }
  });

  it('aviso da extensão não aceito, pela leitura ou pelo pedido', () => {
    const viaLeitura: Link = {
      features: ALL,
      state: { kind: 'sem-leitura', reason: 'consentimento', version: v },
    };
    expect(onboardingSteps(viaLeitura, parado)[0]?.title).toBe('Aceite o aviso da extensão');
    const viaPedido = onboardingSteps(
      { features: ALL, state: { kind: 'lendo', version: v } },
      { kind: 'falhou', reason: 'consentimento' },
    );
    expect(viaPedido[0]?.status).toBe('agora');
  });

  it('extensão pronta, Lattes fechado: passo 2 com o link do Lattes', () => {
    const link: Link = {
      features: ALL,
      state: { kind: 'sem-leitura', reason: 'sem-aba', version: v },
    };
    const [ext, lattes, open] = onboardingSteps(link, { kind: 'falhou', reason: 'sem-aba' });
    expect(ext?.status).toBe('feito');
    expect(lattes).toMatchObject({ status: 'agora' });
    expect(lattes?.action).toEqual({ href: LATTES_URL, kind: 'link', label: 'Abrir o Lattes' });
    expect(open?.status).toBe('depois');
  });

  it('logo depois do aperto de mão, o passo 2 procura o Lattes; sessão vencida oferece recarregar', () => {
    const link: Link = { features: ALL, state: { kind: 'lendo', version: v } };
    expect(onboardingSteps(link, parado)[1]).toMatchObject({ busy: true, status: 'agora' });
    const steps = onboardingSteps(link, { kind: 'falhou', reason: 'sessao' });
    expect(steps[1]?.busy).toBeUndefined();
    expect(steps[1]?.text).toBe('A sessão do Lattes expirou.');
    // A aba ainda mostra o currículo: o que resolve é recarregá-la.
    const reload = { kind: 'recarregar', label: 'Recarregar o Lattes' };
    expect(steps[1]?.action).toEqual(reload);
    // Com o Lattes já lido, quem pede é o passo 3, depois do Abrir do Lattes.
    const read: Link = { features: ALL, state: { kind: 'lido', version: v } };
    expect(onboardingSteps(read, { kind: 'falhou', reason: 'sessao' })[2]?.action).toEqual(reload);
    // Extensão de antes dessa capacidade: o link para o Lattes.
    const old: Link = { features: ['curriculo'], state: { kind: 'lendo', version: v } };
    expect(onboardingSteps(old, { kind: 'falhou', reason: 'sessao' })[1]?.action?.kind).toBe(
      'link',
    );
    // O texto do passo 3 serve aos dois botões: não manda recarregar quem só tem o link.
    const oldRead: Link = { features: ['curriculo'], state: { kind: 'lido', version: v } };
    const step = onboardingSteps(oldRead, { kind: 'falhou', reason: 'sessao' })[2];
    expect(step?.action?.kind).toBe('link');
    expect(step?.text).toBe(
      'A sessão do Lattes expirou. Entre de novo; o currículo abre em seguida.',
    );
  });

  it('Lattes lido: passo 3 abrindo, com falha, ou à espera do clique', () => {
    for (const kind of ['lido', 'outro-cv'] as const) {
      const link: Link = { features: ALL, state: { kind, version: v } };
      expect(statuses(link, { kind: 'abrindo' })).toEqual(['feito', 'feito', 'agora']);
      expect(onboardingSteps(link, { kind: 'abrindo' })[2]?.busy).toBe(true);
    }
    const link: Link = { features: ALL, state: { kind: 'lido', version: v } };
    // Com alterações pendentes, o passo 3 é o envio; enviado, o currículo abre sozinho.
    const pending = onboardingSteps(link, { kind: 'falhou', reason: 'pendente' })[2];
    expect(pending?.text).toMatch(/não enviadas ao CNPq/);
    expect(pending?.action).toEqual({ kind: 'enviar', label: 'Enviar ao CNPq…' });
    // Uma extensão sem o envio: enviar pelo Lattes e tentar de novo.
    const old: Link = {
      features: ALL.filter((f) => f !== 'publicar-cnpq'),
      state: { kind: 'lido', version: v },
    };
    const manual = onboardingSteps(old, { kind: 'falhou', reason: 'pendente' })[2];
    expect(manual?.text).toMatch(/não guardou nenhuma exportação/);
    expect(manual?.action).toEqual({ kind: 'tentar', label: 'Tentar de novo' });
    expect(onboardingSteps(link, parado)[2]?.action?.label).toBe('Abrir do Lattes');
  });

  it('Exportar bloqueado por pendência, com uma versão guardada: abrir essa versão (LAT-46)', () => {
    // Sem o envio na extensão, a versão guardada é o passo; com ele, o envio
    // é o passo e a versão fica como link embaixo (Welcome.tsx).
    const link: Link = {
      features: ALL.filter((f) => f !== 'publicar-cnpq'),
      state: { kind: 'lido', version: v },
    };
    const stored = { date: '06/10/2026', id: 7 };
    const open: OpenState = { kind: 'falhou', lattesId: '1', reason: 'pendente' };
    const withSend: Link = { features: ALL, state: { kind: 'lido', version: v } };
    expect(onboardingSteps(withSend, open, undefined, stored)[2]?.action?.kind).toBe('enviar');
    const step = onboardingSteps(link, open, undefined, stored)[2];
    expect(step?.action).toEqual({ kind: 'versao', label: 'Abrir a exportação de 06/10/2026' });
    expect(step?.text).toMatch(/exportação de 06\/10\/2026, guardada no app; o Histórico/);
    // Enquanto o índice das versões é lido, a tela não diz que não há versão.
    const looking = onboardingSteps(link, open, undefined, 'procurando')[2];
    expect(looking).toMatchObject({ busy: true, status: 'agora' });
    expect(looking?.text).not.toMatch(/não guardou/);
    // Outra falha, mesmo com versão guardada, segue o caminho de sempre.
    const other = onboardingSteps(link, { kind: 'falhou', reason: 'erro' }, undefined, stored)[2];
    expect(other?.action?.kind).toBe('tentar');
  });
});

describe('prévia do primeiro uso no pnpm dev', () => {
  it('cada estado da prévia monta os três passos; nome desconhecido não muda nada', async () => {
    const { onboardingPreview } = await import('../src/dev/onboarding-preview.ts');
    for (const name of [
      'procurando',
      'sem-extensao',
      'antiga',
      'aviso',
      'lattes',
      'abrindo',
      'pendente',
      'pendente-versao',
    ]) {
      const p = onboardingPreview(`?primeiro-uso=${name}`);
      expect(p, name).toBeDefined();
      expect(onboardingSteps(p!.link, p!.open, undefined, p!.stored)).toHaveLength(3);
    }
    expect(onboardingPreview('?primeiro-uso=outro')).toBeUndefined();
    expect(onboardingPreview('')).toBeUndefined();
  });
});
