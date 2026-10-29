import { describe, expect, it } from 'vitest';

import { BRIDGE_FEATURES, compareFeatures, versionNotice } from '../src/bridge/compat.ts';
import { INITIAL_LINK, type Link, nextLink } from '../src/bridge/link.ts';
import {
  BRIDGE_SOURCE,
  type BridgeMessage,
  bridgeMessage,
  isIncompatibleHello,
  type NoReadingReason,
} from '../src/bridge/protocol.ts';
import {
  type Connection,
  connectionLink,
  connectionOf,
  connectionText,
  connectionTitle,
  EXTENSION_URL,
  noticesFor,
} from '../src/ui/notifications.ts';

const ID = '0000000000000001';
const ALL = [...BRIDGE_FEATURES];

const hello = (features?: string[], version = '1.0.0'): BridgeMessage => ({
  features,
  type: 'ola',
  version,
});

const run = (...msgs: BridgeMessage[]): Link =>
  msgs.reduce((l, m) => nextLink(l, m, ID), INITIAL_LINK);

describe('conector: capacidades', () => {
  it('diz qual dos lados está atrás', () => {
    expect(compareFeatures(ALL, ALL)).toEqual({ kind: 'ok' });
    expect(compareFeatures(ALL, undefined)).toEqual({ kind: 'outro-antigo', missing: ALL });
    expect(compareFeatures(ALL, ['estado-lattes'])).toEqual({
      kind: 'outro-antigo',
      missing: ALL.filter((f) => f !== 'estado-lattes'),
    });
    expect(compareFeatures(ALL, [...ALL, 'criar'])).toEqual({
      kind: 'este-antigo',
      unknown: ['criar'],
    });
  });

  it('o painel da extensão avisa qual atualizar, e só quando não combinam', () => {
    expect(versionNotice('2.0.0', undefined)).toBeUndefined();
    expect(versionNotice('2.0.0', { features: ALL, version: '2.0.0' })).toBeUndefined();
    expect(versionNotice('2.0.0', {})).toBe(
      'O app LattesEditor não usa tudo o que esta extensão (v2.0.0) faz. Baixe a versão nova do app.',
    );
    expect(versionNotice('2.0.0', { features: [], version: '1.0.0' })).toMatch(
      /^O app LattesEditor \(v1\.0\.0\) não usa tudo/,
    );
    expect(versionNotice('1.0.0', { features: [...ALL, 'criar'], version: '2.0.0' })).toBe(
      'O app LattesEditor (v2.0.0) usa recursos que esta extensão (v1.0.0) ainda não tem. Atualize a extensão.',
    );
    expect(versionNotice('1.0.0', { features: [...ALL, 'criar'] })).toBe(
      'O app LattesEditor usa recursos que esta extensão (v1.0.0) ainda não tem. Atualize a extensão.',
    );
  });

  it('reconhece o "ola" de uma extensão com outro protocolo', () => {
    expect(isIncompatibleHello({ source: BRIDGE_SOURCE, type: 'ola', v: 2 })).toBe(true);
    expect(isIncompatibleHello(bridgeMessage(hello(ALL)))).toBe(false);
    expect(isIncompatibleHello({ source: BRIDGE_SOURCE, type: 'fim', v: 2 })).toBe(false);
    expect(isIncompatibleHello({ source: 'outra', type: 'ola', v: 2 })).toBe(false);
    expect(isIncompatibleHello(null)).toBe(false);
  });
});

describe('conector: estado da ligação', () => {
  it('do aperto de mão à leitura', () => {
    expect(run(hello(ALL)).state).toEqual({ kind: 'lendo', version: '1.0.0' });
    const read = run(hello(ALL), {
      lattesId: ID,
      status: { pending: false },
      type: 'estado-lattes',
    });
    expect(read).toEqual({
      features: ALL,
      outdated: undefined,
      state: { kind: 'lido', version: '1.0.0' },
    });
    // Um "ola" de reconexão não apaga a leitura.
    expect(nextLink(read, hello(ALL, '1.0.1'), ID).state).toEqual({
      kind: 'lido',
      version: '1.0.1',
    });
    // Nem uma releitura que falhou.
    expect(nextLink(read, { reason: 'erro', type: 'sem-leitura' }, ID)).toBe(read);
  });

  it('sessão de outro currículo', () => {
    const link = run(hello(ALL), {
      lattesId: '0000000000000002',
      status: { pending: false },
      type: 'estado-lattes',
    });
    expect(link.state.kind).toBe('outro-cv');
    expect(nextLink(link, hello(ALL), ID).state.kind).toBe('outro-cv');
  });

  it('o motivo de não ter lido', () => {
    expect(run(hello(ALL), { reason: 'sem-aba', type: 'sem-leitura' }).state).toEqual({
      kind: 'sem-leitura',
      reason: 'sem-aba',
      version: '1.0.0',
    });
    // Sem "ola" antes, a versão fica em branco.
    expect(run({ reason: 'erro', type: 'sem-leitura' }).state).toEqual({
      kind: 'sem-leitura',
      reason: 'erro',
      version: '',
    });
  });

  it('marca o lado desatualizado', () => {
    expect(run(hello(undefined, '0.9.1')).outdated).toEqual({
      side: 'extensao',
      version: '0.9.1',
    });
    expect(run(hello([...ALL, 'criar'], '3.0.0')).outdated).toEqual({
      side: 'app',
      version: '3.0.0',
    });
  });

  it('outras mensagens não mexem na ligação', () => {
    expect(nextLink(INITIAL_LINK, { type: 'fim' }, ID)).toBe(INITIAL_LINK);
  });
});

describe('notificações: ligação com o Lattes e armazenamento', () => {
  const reasons: [NoReadingReason, Connection['kind']][] = [
    ['consentimento', 'sem-consentimento'],
    ['sem-aba', 'sem-aba'],
    ['sem-data', 'sem-data'],
    ['erro', 'sem-leitura'],
  ];

  it('sem leitura, diz por quê', () => {
    expect(connectionOf(undefined, false)).toBeUndefined();
    expect(connectionOf(INITIAL_LINK, false)).toEqual({ kind: 'procurando' });
    expect(connectionOf({ state: { kind: 'sem-extensao' } }, false)).toEqual({
      kind: 'sem-extensao',
    });
    for (const [reason, kind] of reasons) {
      expect(connectionOf(run(hello(ALL), { reason, type: 'sem-leitura' }), false)).toEqual({
        kind,
      });
    }
    expect(connectionOf(run(hello(ALL)), true)).toBeUndefined();
    expect(connectionOf({ state: { kind: 'lido', version: '1' } }, false)).toBeUndefined();
  });

  it('um lado desatualizado aparece mesmo com leitura', () => {
    expect(connectionOf(run(hello(undefined, '0.9.1')), true)).toEqual({
      kind: 'extensao-antiga',
      version: '0.9.1',
    });
    expect(connectionOf(run(hello([...ALL, 'criar'], '3.0.0')), true)).toEqual({
      kind: 'app-antigo',
      version: '3.0.0',
    });
  });

  it('o que pede ação acende o sino; o resto só aparece ao abrir', () => {
    const at = (connection?: Connection, storage: 'cifrado' | 'sem-chave' = 'cifrado') =>
      noticesFor({ appVersion: '2.0.0', connection, storage });
    expect(at()).toEqual([]);
    expect(at({ kind: 'procurando' })).toEqual([]);
    expect(at({ kind: 'lendo' })).toEqual([]);
    expect(at({ kind: 'sem-aba' })).toEqual([
      expect.objectContaining({ id: 'ligacao', level: 'info', title: 'Lattes fechado' }),
    ]);
    expect(at({ kind: 'extensao-antiga', version: '0.9.1' })).toEqual([
      {
        id: 'ligacao',
        level: 'aviso',
        link: { href: EXTENSION_URL, label: 'Atualize a extensão no navegador.' },
        text: 'O editor (v2.0.0) usa recursos que a extensão (v0.9.1) ainda não tem.',
        title: 'Extensão desatualizada',
      },
    ]);
    // O armazenamento vem antes e abre o aviso dele.
    expect(at({ kind: 'sem-extensao' }, 'sem-chave').map((n) => [n.id, n.level, n.action])).toEqual(
      [
        ['armazenamento', 'aviso', 'armazenamento'],
        ['ligacao', 'info', undefined],
      ],
    );
    expect(
      noticesFor({ appVersion: '2.0.0', storage: 'chave-perdida' }).map((n) => n.title),
    ).toEqual(['Dados guardados ilegíveis']);
  });

  it('alterações no Lattes que não passaram por aqui: aviso no sino que abre o Histórico comparando', () => {
    const [n] = noticesFor({ appVersion: '2.0.0', storage: 'cifrado', unknownPending: true });
    expect(n).toMatchObject({
      action: 'comparar-lattes',
      id: 'pendencia-desconhecida',
      level: 'aviso',
    });
    expect(noticesFor({ appVersion: '2.0.0', storage: 'cifrado' })).toEqual([]);
  });

  it('todo estado tem título e um texto do que fazer', () => {
    const all: Connection[] = [
      { kind: 'app-antigo', version: '3.0.0' },
      { kind: 'extensao-antiga', version: '0.9.1' },
      { kind: 'incompativel' },
      { kind: 'lendo' },
      { kind: 'outro-cv' },
      { kind: 'procurando' },
      { kind: 'sem-aba' },
      { kind: 'sem-consentimento' },
      { kind: 'sem-data' },
      { kind: 'sem-extensao' },
      { kind: 'sem-leitura' },
    ];
    expect(new Set(all.map(connectionTitle)).size).toBe(all.length);
    for (const c of all) expect(connectionText(c, '2.0.0').length).toBeGreaterThan(20);
    // A diferença é de recursos: o texto não diz que um número é maior que o
    // outro, nem com o número do manifesto da extensão Dev (1.0.0.98) contra o
    // do app (1.0.0-dev.98).
    for (const [ext, app] of [
      ['1.0.0-dev.93', '1.0.0-dev.93'],
      ['1.0.0.98', '1.0.0-dev.98'],
      ['1.0.0.97', '1.0.0-dev.98'],
    ] as const) {
      for (const kind of ['app-antigo', 'extensao-antiga'] as const) {
        const text = connectionText({ kind, version: ext }, app);
        expect(text).not.toMatch(/mais (nova|antiga|novo|antigo)/);
        expect(text).toContain(`v${ext}`);
        expect(text).toContain(`v${app}`);
      }
    }
    // Só o que se resolve atualizando um dos lados leva link.
    expect(all.filter((c) => connectionLink(c)).map((c) => c.kind)).toEqual([
      'app-antigo',
      'extensao-antiga',
      'incompativel',
    ]);
  });
});
