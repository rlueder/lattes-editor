import { describe, expect, it } from 'vitest';

import type { BridgeOp } from '../src/bridge/plan.ts';
import {
  groupByDay,
  sentEntry,
  UNDO_KEY_PREFIX,
  undoneIds,
  undoOp,
} from '../src/bridge/sent-log.ts';
import { acceptChange, diffDocuments, reopenChange } from '../src/model/changes.ts';
import { parseXml } from '../src/model/xml.ts';

const vinculo: BridgeOp = {
  codInst: 'D001',
  expect: { f_ano_fim: '', f_ano_ini: '2010', f_mes_ini: '3', f_status: 'S' },
  key: 'v',
  kind: 'vinculo',
  label: 'Vínculo: Universidade',
  seqAtiv: '1',
  seqHist: '2',
  set: { f_ano_fim: '2025', f_status: 'N' },
};

const idioma: BridgeOp = {
  code: 'EN',
  expect: { FC_LE: null, F_LE: null },
  key: 'i',
  kind: 'idioma',
  label: 'Idioma: Inglês',
  set: { FC_LE: 'on', F_LE: 'B' },
};

describe('registro do que foi enviado ao Lattes', () => {
  it('guarda a operação e as linhas antes → depois', () => {
    const entry = sentEntry(vinculo, '123', 1000);
    expect(entry).toMatchObject({ lattesId: '123', op: vinculo, sentAt: 1000 });
    expect(entry.rows.map((r) => `${r.label}: ${r.before} → ${r.after}`)).toEqual([
      'Ano de fim: (vazio) → 2025',
      'Situação: Atual → Anterior',
    ]);
    expect(sentEntry(idioma, '123', 1, { undoOf: 7 }).undoOf).toBe(7);
  });

  it('desfaz trocando gravado e esperado, com a identidade do vínculo intacta', () => {
    const reverse = undoOp({ ...sentEntry(vinculo, '123', 1), id: 4 });
    expect(reverse).toEqual({
      ...vinculo,
      expect: { f_ano_fim: '2025', f_ano_ini: '2010', f_mes_ini: '3', f_status: 'N' },
      key: `${UNDO_KEY_PREFIX}4`,
      label: 'Desfazer: Vínculo: Universidade',
      set: { f_ano_fim: '', f_status: 'S' },
    });
  });

  it('desfaz idioma e resumo, inclusive a caixa desmarcada', () => {
    expect(undoOp({ ...sentEntry(idioma, '1', 1), id: 1 })).toMatchObject({
      code: 'EN',
      expect: { FC_LE: 'on', F_LE: 'B' },
      set: { FC_LE: null, F_LE: null },
    });
    const resumo: BridgeOp = {
      expect: { F_TEXTO: 'antes' },
      key: 'r',
      kind: 'resumo',
      label: 'Resumo',
      set: { F_TEXTO: 'depois' },
    };
    expect(undoOp({ ...sentEntry(resumo, '1', 1), id: 2 })).toMatchObject({
      expect: { F_TEXTO: 'depois' },
      set: { F_TEXTO: 'antes' },
    });
  });

  it('não desfaz sem id, sem o antes de um campo, nem uma entrada que já é desfazer', () => {
    expect(undoOp(sentEntry(vinculo, '1', 1))).toBeUndefined();
    const noBefore: BridgeOp = { ...vinculo, expect: {}, set: { f_ano_fim: '2025' } };
    expect(undoOp({ ...sentEntry(noBefore, '1', 1), id: 1 })).toBeUndefined();
    const empty: BridgeOp = { ...vinculo, set: {} };
    expect(undoOp({ ...sentEntry(empty, '1', 1), id: 1 })).toBeUndefined();
    expect(undoOp({ ...sentEntry(vinculo, '1', 1, { undoOf: 3 }), id: 5 })).toBeUndefined();
  });

  it('sabe o que já foi desfeito', () => {
    const entries = [
      { ...sentEntry(vinculo, '1', 1), id: 1 },
      { ...sentEntry(idioma, '1', 2), id: 2 },
      { ...sentEntry(vinculo, '1', 3, { undoOf: 1 }), id: 3 },
    ];
    expect([...undoneIds(entries)]).toEqual([1]);
  });

  it('agrupa por dia, do mais recente ao mais antigo', () => {
    const at = (iso: string) => new Date(iso).getTime();
    const days = groupByDay([
      sentEntry(vinculo, '1', at('2026-10-11T09:00:00')),
      sentEntry(idioma, '1', at('2026-10-12T18:00:00')),
      sentEntry(vinculo, '1', at('2026-10-12T08:00:00')),
    ]);
    expect(days.map((d) => [d.day, d.entries.map((e) => e.op.key)])).toEqual([
      ['2026-10-12', ['i', 'v']],
      ['2026-10-11', ['v']],
    ]);
  });
});

describe('reabrir uma mudança desfeita no Lattes', () => {
  const ORIGINAL = `<CURRICULO-VITAE><DADOS-GERAIS>
    <ATUACOES-PROFISSIONAIS><ATUACAO-PROFISSIONAL SEQUENCIA-ATIVIDADE="1">
      <VINCULOS SEQUENCIA-HISTORICO="1" ANO-INICIO="2010"/>
    </ATUACAO-PROFISSIONAL></ATUACOES-PROFISSIONAIS>
  </DADOS-GERAIS></CURRICULO-VITAE>`;

  it('volta o original ao valor de antes, e a mudança reaparece', () => {
    const original = parseXml(ORIGINAL).root;
    const working = parseXml(
      ORIGINAL.replace('ANO-INICIO="2010"', 'ANO-INICIO="2011" ANO-FIM="2020"'),
    ).root;
    const [change] = diffDocuments(original, working);
    expect(acceptChange(original, working, change!)).toBe(true);
    expect(diffDocuments(original, working)).toEqual([]);
    expect(reopenChange(original, change!)).toBe(true);
    expect(diffDocuments(original, working).map((c) => c.key)).toEqual([change!.key]);
  });

  it('não mexe em inclusão, em texto nem em caminho que sumiu', () => {
    const original = parseXml(ORIGINAL).root;
    const working = parseXml(
      ORIGINAL.replace(
        'ANO-INICIO="2010"/>',
        'ANO-INICIO="2010"/><VINCULOS SEQUENCIA-HISTORICO="2"/>',
      ),
    ).root;
    const [added] = diffDocuments(original, working);
    expect(added?.kind).toBe('novo');
    expect(reopenChange(original, added!)).toBe(false);

    const changed = parseXml(ORIGINAL.replace('ANO-INICIO="2010"', 'ANO-INICIO="2011"')).root;
    const [change] = diffDocuments(original, changed);
    const text = { ...change!, fields: [{ ...change!.fields[0]!, attr: '#texto' }] };
    expect(reopenChange(original, text)).toBe(false);
    const gone = {
      ...change!,
      path: [...change!.path.slice(0, -1), 'VINCULOS[SEQUENCIA-HISTORICO=9]'],
    };
    expect(reopenChange(original, gone)).toBe(false);
  });
});
