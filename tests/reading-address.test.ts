// Endereço na leitura (addressLayout): telefone num valor só, com DDD, ramal
// e fax; caixa postal, e-mail e página em linhas; o DDD não repete na grade.

import { describe, expect, it } from 'vitest';

import { parseXml } from '../src/model/xml.ts';
import { addressLayout, lineText } from '../src/ui/reading-layout.ts';

const opts = { hideSensitive: false, showCodes: false };

describe('endereço na leitura', () => {
  it('junta DDD e telefone, com ramal e fax, e não repete o DDD na grade', () => {
    const el = parseXml(
      `<ENDERECO><ENDERECO-PROFISSIONAL NOME-INSTITUICAO-EMPRESA="Universidade" DDD="51" TELEFONE="00001234" RAMAL="12" FAX="000012345" CAIXA-POSTAL="15" E-MAIL="a@example.org"/></ENDERECO>`,
    ).root;
    const [prof] = addressLayout(el, opts);
    const lines = prof!.lines.map(lineText).filter(Boolean);
    expect(lines).toContain('Telefone (51) 0000-1234, ramal 12 · Fax (51) 00001-2345');
    expect(lines).toContain('Caixa postal 15');
    expect(lines).toContain('a@example.org');
    expect(prof!.rows.map((r) => r.attr)).not.toContain('DDD');
  });

  it('DDD sem telefone fica na grade', () => {
    const el = parseXml(`<ENDERECO><ENDERECO-PROFISSIONAL DDD="51"/></ENDERECO>`).root;
    expect(addressLayout(el, opts)[0]!.rows.map((r) => r.attr)).toContain('DDD');
  });
});
