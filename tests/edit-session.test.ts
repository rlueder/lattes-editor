// Um bloco em edição de cada vez: abrir outro fecha o aberto antes, e o que
// estava sendo digitado nele grava, como no "Concluir".

import { afterEach, describe, expect, it } from 'vitest';

import { getAttr, parseXml, setAttr } from '../src/model/xml.ts';
import {
  type OpenEditor,
  openEditor,
  openOnly,
  registerOpen,
  resetEditSession,
  unregister,
} from '../src/ui/edit-session.ts';

afterEach(resetEditSession);

/** Um bloco de mentira, com um campo em foco que grava ao fechar (perder o foco). */
function block(name: string, log: string[], typing?: () => void) {
  const editor: OpenEditor = {
    close: () => {
      typing?.();
      log.push(`fecha ${name}`);
      unregister(editor);
    },
  };
  const open = () => {
    log.push(`abre ${name}`);
    registerOpen(editor);
  };
  return { editor, open: () => openOnly(open, editor) };
}

describe('um bloco em edição de cada vez', () => {
  it('sem bloco aberto, abre direto', () => {
    const log: string[] = [];
    block('a', log).open();
    expect(log).toEqual(['abre a']);
  });

  it('abrir outro fecha o aberto antes, e o novo fica sendo o aberto', () => {
    const log: string[] = [];
    const a = block('a', log);
    const b = block('b', log);
    a.open();
    b.open();
    expect(log).toEqual(['abre a', 'fecha a', 'abre b']);
    expect(openEditor()).toBe(b.editor);
  });

  it('abrir de novo o próprio bloco aberto não o fecha', () => {
    const log: string[] = [];
    const a = block('a', log);
    a.open();
    a.open();
    expect(log).toEqual(['abre a', 'abre a']);
  });

  it('o que estava sendo digitado no primeiro bloco grava quando o segundo abre', () => {
    const dg = parseXml('<DADOS-GERAIS NOME-COMPLETO="Ana"/>').root;
    let draft = 'Ana Lima';
    const log: string[] = [];
    // Fechar tira o foco do campo, que grava o rascunho, como no "Concluir".
    const a = block('identificação', log, () => setAttr(dg, 'NOME-COMPLETO', draft));
    a.open();
    draft = 'Ana Beatriz Lima';
    block('endereço', log).open();
    expect(getAttr(dg, 'NOME-COMPLETO')).toBe('Ana Beatriz Lima');
    expect(log).toEqual(['abre identificação', 'fecha identificação', 'abre endereço']);
  });

  it('fechar um bloco que não é o aberto não mexe no aberto', () => {
    const log: string[] = [];
    const a = block('a', log);
    const b = block('b', log);
    b.open();
    unregister(a.editor);
    expect(openEditor()).toBe(b.editor);
  });
});
