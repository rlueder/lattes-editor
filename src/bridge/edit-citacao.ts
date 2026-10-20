// O nome para citação de um coautor, pelo dicionário de coautores do Lattes
// (formulário GN_AUTOR, POST PKG_DIC_AUTOR.FORM). Lido em 19/10/2026 no
// Lattes real:
//
// - A lista (pkg_dic_autor.lista, linkada no menu) traz uma linha por coautor,
//   com onclick pp_autor(n), o nome, o nome em citações e quantas produções e
//   projetos o usam. pp_autor abre pkg_dic_autor.form?f_cod=…&f_seq=n.
// - O formulário tem f_nome, f_nome_cit (até 60 letras), f_cod, f_seq,
//   f_tipo, f_ctr (U), f_id, f_sta_old e a caixa f_chk. O check() da página,
//   quando a citação muda, pergunta a pkg_dic_autor.existe_prod_validada
//   (POST com f_cod e f_seq, resposta S ou N); com S, mostra as produções
//   validadas e não envia.
// - A linha de autor de cada produção aponta para a entrada do dicionário
//   pelo c. Trocar o t na linha não pega (a releitura voltava com o antigo), e
//   trocar a entrada muda a citação em todas as produções do coautor.
//
// A própria pessoa não está no dicionário: a linha dela no autorDP do menu
// tem o c vazio.

import type { Change } from '../model/changes.ts';
import { foldText } from '../model/fold-text.ts';
import { getAttr, type XElement } from '../model/xml.ts';
import type { LattesPort, OpResult } from './apply.ts';
import { ownerNamesOf } from './author-grid.ts';
import { getChecked, Stop } from './create-shared.ts';
import { encodeLatin1Form, pairValue, setPairs, successfulPairs } from './form.ts';
import { decodeHtmlEntities } from './html-text.ts';
import { findLinks, isLogonPage } from './lattes-html.ts';
import type { OpBase } from './plan.ts';
import { authorPartOf } from './production/plan.ts';

/** Trocar a citação de coautores pelo conector. */
export const EDIT_CITACOES_ENABLED = true;

const MAX_CITATION = 60;

export interface CitacaoOp extends OpBase {
  citation: { after: string; before: string };
  kind: 'citacao';
  /** O nome completo do coautor, como o dicionário o mostra. */
  name: string;
  rows: { after: string; before: string; label: string; name: string }[];
}

export const isCitacaoOp = (op: { kind: string }): op is CitacaoOp => op.kind === 'citacao';

/** A troca da citação de um coautor, ou o motivo de ficar à mão; undefined se não é. */
export function planCitacao(
  change: Change,
  chain: XElement[],
  label: string,
): CitacaoOp | { reason: string } | undefined {
  if (change.kind !== 'alterado') return undefined;
  const found = authorPartOf(change, chain);
  if (!found) return undefined;
  const { part } = found;
  const field = change.fields.find((f) => f.attr === part.citation);
  if (!field) return undefined;
  const el = chain.at(-1);
  const name = (el && getAttr(el, part.name))?.trim() ?? '';
  const others = change.fields.filter((f) => f !== field && !f.attr.startsWith('CPF'));
  if (others.length > 0) {
    return {
      reason: `A citação vai pelo dicionário de coautores, num envio só dela: envie antes ${others.map((f) => f.label).join(', ')}`,
    };
  }
  const before = field.before.trim();
  const after = field.after.trim();
  const owner = ownerNamesOf(chain[0]);
  const fold = foldText;
  if (
    owner &&
    (fold(owner.full) === fold(name) || owner.citations.some((c) => fold(c) === fold(before)))
  ) {
    return {
      reason:
        'A sua própria citação: o conector troca só a de coautores, pelo dicionário de coautores do Lattes; troque no Lattes',
    };
  }
  if (!name) return { reason: 'Coautor sem nome completo, pelo qual o dicionário o acha' };
  if (!after) return { reason: 'O Lattes exige o nome em citações do coautor' };
  if (after.length > MAX_CITATION) {
    return { reason: `O nome em citações do Lattes vai até ${MAX_CITATION} letras` };
  }
  return {
    citation: { after, before },
    expect: { f_nome_cit: before },
    key: change.key,
    kind: 'citacao',
    label,
    name,
    rows: [
      {
        after,
        before,
        // O aviso fica na linha que a pessoa confere antes de enviar.
        label: `Citação de ${name} (dicionário de coautores: muda em todas as produções dele)`,
        name: 'f_nome_cit',
      },
    ],
    set: { f_nome_cit: after },
  };
}

interface DictRow {
  citation: string;
  name: string;
  productions: string;
  seq: string;
}

/** As linhas da lista do dicionário de coautores. */
export function dictionaryRows(html: string): DictRow[] {
  const rows: DictRow[] = [];
  for (const m of html.matchAll(/pp_autor\((\d+)\)[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...m[2]!.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((c) =>
      decodeHtmlEntities(c[1]!.replace(/<[^>]+>/g, ''))
        .replace(/\u00a0/g, ' ')
        .trim(),
    );
    rows.push({
      citation: cells[1] ?? '',
      name: cells[0] ?? '',
      productions: cells[2] ?? '',
      seq: m[1]!,
    });
  }
  return rows;
}

const same = (a: string, b: string) => foldText(a.trim()) === foldText(b.trim());

export async function applyCitacao(op: CitacaoOp, port: LattesPort): Promise<OpResult> {
  const result = (status: OpResult['status'], detail: string): OpResult => ({
    detail,
    key: op.key,
    status,
  });
  let posted = false;
  try {
    const link = findLinks(await port.menuHtml(), 'pkg_dic_autor.lista')[0];
    const code = link?.params.f_cod;
    if (!link || !code) {
      return result('erro', 'O dicionário de coautores não está no menu do Lattes');
    }
    const named = dictionaryRows(await getChecked(port, link.path)).filter((r) =>
      same(r.name, op.name),
    );
    const hits = named.filter((r) => same(r.citation, op.citation.before));
    if (hits.length === 0 && named.some((r) => same(r.citation, op.citation.after))) {
      // Outra troca da fila, de outra produção do mesmo coautor, já gravou.
      return result('conferido', 'A citação já estava trocada no dicionário de coautores');
    }
    if (hits.length !== 1) {
      return result(
        named.length > 0 ? 'divergente' : 'erro',
        named.length > 0
          ? 'O coautor está no dicionário do Lattes com outra citação; nada foi enviado'
          : `${op.name} não está no dicionário de coautores do Lattes; troque no Lattes`,
      );
    }
    const row = hits[0]!;
    const path = `pkg_dic_autor.form?f_cod=${code}&f_seq=${row.seq}`;
    const html = await getChecked(port, path);
    const controls = port.readForm(html, 'GN_AUTOR');
    if (!controls) {
      return result('erro', 'A página do coautor no Lattes não veio como o conector conhece');
    }
    const pairs = successfulPairs(controls);
    if (pairValue(pairs, 'f_ctr') !== 'U' || pairValue(pairs, 'f_seq') !== row.seq) {
      return result('erro', 'O formulário do coautor não está em modo de alteração');
    }
    if (
      !same(pairValue(pairs, 'f_nome') ?? '', op.name) ||
      !same(pairValue(pairs, 'f_nome_cit') ?? '', op.citation.before)
    ) {
      return result('divergente', 'O Lattes não está como o editor espera: Citação do coautor');
    }
    // A mesma pergunta que o check() faz antes de enviar.
    const validated = (
      await port.post(
        'pkg_dic_autor.existe_prod_validada',
        encodeLatin1Form([
          ['f_cod', code],
          ['f_seq', row.seq],
        ]),
      )
    ).trim();
    if (validated === 'S') {
      return result(
        'erro',
        'O coautor tem produção validada, e o Lattes não deixa trocar a citação dele; nada foi enviado',
      );
    }
    if (validated !== 'N') {
      return result('erro', 'O Lattes não respondeu se o coautor tem produção validada');
    }
    const action =
      /<form\b[^>]*action\s*=\s*["']?([^"'\s>]+)[^>]*name\s*=\s*["']?GN_AUTOR\b/i.exec(html)?.[1] ??
      'PKG_DIC_AUTOR.FORM';
    posted = true;
    const response = await port.post(action, encodeLatin1Form(setPairs(pairs, op.set)));
    if (isLogonPage(response)) return result('sessao', 'A sessão do Lattes expirou; entre de novo');
    const after = port.readForm(await getChecked(port, path), 'GN_AUTOR');
    const now = after && pairValue(successfulPairs(after), 'f_nome_cit');
    if (!now || !same(now, op.citation.after)) {
      return result('divergente', 'O Lattes não gravou a citação do coautor. Confira no Lattes');
    }
    const uses = Number(row.productions);
    return result(
      'conferido',
      `Gravado e conferido no dicionário de coautores${uses > 1 ? `; a citação mudou nas ${uses} produções do coautor` : ''}`,
    );
  } catch (err) {
    if (err instanceof Stop) return result(err.status, err.message);
    const why = err instanceof Error ? err.message : String(err);
    return posted
      ? result('divergente', `Falha no meio do envio (${why}); confira no Lattes`)
      : result('erro', why);
  }
}
