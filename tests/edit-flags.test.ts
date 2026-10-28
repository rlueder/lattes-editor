// As chaves de alteração que dependem de uma capacidade da extensão
// (GATED_EDITS, src/bridge/plan.ts): a capacidade entra em BRIDGE_FEATURES no
// mesmo commit em que a chave liga, e só então.

import { describe, expect, it } from 'vitest';

import { BUILD_GATES } from '../src/bridge/apply.ts';
import { BRIDGE_FEATURES } from '../src/bridge/compat.ts';
import { LATTES_CONTRACT } from '../src/bridge/contract.ts';
import { EDIT_EVENTO_ENABLED } from '../src/bridge/edit-items.ts';
import {
  type BridgeOp,
  GATED_EDITS,
  OLD_EXTENSION,
  planChanges,
  planOptionsFor,
} from '../src/bridge/plan.ts';
import { partGate } from '../src/bridge/plan-gates.ts';
import { diffDocuments } from '../src/model/changes.ts';
import { parseXml, setAttr } from '../src/model/xml.ts';
import { findIn } from './helpers/lattes-simulado.ts';

describe('chaves de alteração e capacidades da extensão', () => {
  it('cada chave ligada tem a capacidade anunciada, e cada desligada não', () => {
    for (const g of GATED_EDITS) {
      expect({
        feature: g.feature,
        on: (BRIDGE_FEATURES as readonly string[]).includes(g.feature),
      }).toEqual({ feature: g.feature, on: g.enabled });
    }
  });

  it('cada chave tem opção e capacidade próprias', () => {
    const options = GATED_EDITS.map((g) => g.option);
    const features = GATED_EDITS.map((g) => g.feature);
    expect(new Set(options).size).toBe(options.length);
    expect(new Set(features).size).toBe(features.length);
  });

  it('a extensão sem a capacidade deixa a chave desligada no plano', () => {
    const all = GATED_EDITS.map((g) => g.feature);
    for (const g of GATED_EDITS) {
      expect(planOptionsFor(all)[g.option]).toBe(g.enabled);
      expect(planOptionsFor([])[g.option]).toBe(false);
    }
  });
});

describe('chaves do lado da extensão', () => {
  it('BUILD_GATES segue as chaves da montagem e o contrato', () => {
    expect(BUILD_GATES.editEvento).toBe(EDIT_EVENTO_ENABLED);
    const inContract = (['formacao-complementar', 'premio'] as const).filter(
      (k) => LATTES_CONTRACT.forms[k] !== undefined,
    );
    expect([...BUILD_GATES.lists].sort()).toEqual(inContract);
  });

  it('esta montagem, com tudo ligado, deixa passar cada operação atrás de chave', () => {
    // Para o teste ao vivo: todas as chaves ligadas, com a capacidade
    // anunciada, menos a do órgão do projeto, que o Lattes não gravou no teste
    // de 18/10/2026 (production/plan.ts).
    const live = GATED_EDITS.filter((g) => g.feature !== 'orgao-projeto');
    expect(live.every((g) => g.enabled)).toBe(true);
    expect(BUILD_GATES.editEvento).toBe(true);
    expect([...BUILD_GATES.lists].sort()).toEqual(['formacao-complementar', 'premio']);
    const all = planOptionsFor(BRIDGE_FEATURES);
    for (const g of live) expect(all[g.option]).toBe(true);
  });
});

describe('extensão anterior a uma alteração', () => {
  it('o motivo diz para atualizar a extensão, só quando o plano vem dela', () => {
    const xml = `<CURRICULO-VITAE NUMERO-IDENTIFICADOR="1"><DADOS-GERAIS NOME-COMPLETO="P"/>
<PRODUCAO-BIBLIOGRAFICA><DEMAIS-TIPOS-DE-PRODUCAO-BIBLIOGRAFICA>
<OUTRA-PRODUCAO-BIBLIOGRAFICA SEQUENCIA-PRODUCAO="3"><DADOS-BASICOS-DE-OUTRA-PRODUCAO NATUREZA="OUTRA" TITULO="Ensaio" ANO="2004"/></OUTRA-PRODUCAO-BIBLIOGRAFICA>
</DEMAIS-TIPOS-DE-PRODUCAO-BIBLIOGRAFICA></PRODUCAO-BIBLIOGRAFICA></CURRICULO-VITAE>`;
    const original = parseXml(xml).root;
    const working = parseXml(xml).root;
    const basics = findIn(working, (el) => el.name === 'DADOS-BASICOS-DE-OUTRA-PRODUCAO')!;
    setAttr(basics, 'TITULO', 'Ensaio revisto');
    const entries = diffDocuments(original, working).map((change) => ({ change, itemTitle: '' }));
    const old = planOptionsFor(['alterar-dados-gerais']);
    expect(planChanges(entries, working, old, true).unsupported[0]?.reason).toBe(OLD_EXTENSION);
    expect(planChanges(entries, working, old).unsupported[0]?.reason).not.toBe(OLD_EXTENSION);
    expect(
      planChanges(entries, working, planOptionsFor([...BRIDGE_FEATURES]), true).ops,
    ).toHaveLength(1);
  });
});

describe('partes novas de uma operação', () => {
  it('a deficiência, outra forma de contato e o financiador só vão com a capacidade', () => {
    const xml = `<CURRICULO-VITAE NUMERO-IDENTIFICADOR="1"><DADOS-GERAIS NOME-COMPLETO="P">
<ENDERECO FLAG-DE-PREFERENCIA="ENDERECO_INSTITUCIONAL" REDE-SOCIAL="" ELETRONICO="" OUTRA-FORMA-DE-CONTATO="ID Rede Social: 1, Nome Rede Social: MSN, Endereço: a@example.org"><ENDERECO-PROFISSIONAL NOME-INSTITUICAO-EMPRESA="U"/></ENDERECO></DADOS-GERAIS></CURRICULO-VITAE>`;
    const original = parseXml(xml).root;
    const working = parseXml(xml).root;
    const endereco = findIn(working, (el) => el.name === 'ENDERECO')!;
    setAttr(
      endereco,
      'OUTRA-FORMA-DE-CONTATO',
      'ID Rede Social: 1, Nome Rede Social: MSN, Endereço: b@example.org',
    );
    const entries = diffDocuments(original, working).map((change) => ({ change, itemTitle: '' }));
    const without = planOptionsFor([...BRIDGE_FEATURES].filter((f) => f !== 'outra-forma-contato'));
    expect(planChanges(entries, working, without).unsupported[0]?.reason).toMatch(
      /Outra forma de contato pelo conector: desligado/,
    );
    expect(planChanges(entries, working, without, true).unsupported[0]?.reason).toBe(OLD_EXTENSION);
    expect(planChanges(entries, working, planOptionsFor([...BRIDGE_FEATURES])).ops).toHaveLength(1);
  });

  it('cada parte tem o motivo dela', () => {
    const op = { kind: 'producao' } as unknown as BridgeOp;
    expect(partGate({ ...op, pcd: { after: [], before: [] } } as BridgeOp, {})).toMatch(
      /deficiência/,
    );
    expect(partGate({ ...op, funder: { code: '1' } } as BridgeOp, {})).toMatch(/Financiador/);
    expect(partGate({ ...op, funder: { code: '1' } } as BridgeOp, { editFunders: true })).toBe(
      undefined,
    );
  });
});
