// O que cada lado do conector sabe fazer, trocado no aperto de mão ("ola"). O
// app e a extensão saem do mesmo release com o mesmo número de versão, mas
// cada um se atualiza no seu tempo: a extensão pela loja (ou à mão, quando
// carregada sem empacotar), o app só quando a pessoa baixa outro instalador.
// Comparar o número diria só que são diferentes; a lista diz o que deixa de
// funcionar e qual dos dois precisa de atualização.
//
// Regras da lista:
// - entra uma capacidade quando um tipo de mensagem novo passa a ser usado
//   pelos dois lados;
// - nenhuma sai, mesmo que deixe de ser usada: um lado mais novo sem ela
//   pareceria o mais antigo.

export const BRIDGE_FEATURES = [
  /** Data da última publicação e pendência, lidas do menu do Lattes. */
  'estado-lattes',
  /** Versão atual do Lattes (pkg_publicar.cv_espelho), para o diagnóstico. */
  'espelho',
  /** O motivo de não ter lido o Lattes, para o cabeçalho explicar. */
  'sem-leitura',
  /** O ZIP do Exportar, pedido pelo editor (src/bridge/export.ts). */
  'curriculo',
  /** Troca da foto do currículo (src/bridge/photo.ts). */
  'foto',
  /** Recarregar a aba do Lattes quando a sessão venceu. */
  'recarregar-lattes',
  /** Importar dos itens novos pelo conector, passos 1 e 2 (src/bridge/importar.ts). */
  'importar',
  /** Áreas, agências, busca de instituição e cursos lidos no Lattes (src/bridge/lattes-lists.ts). */
  'listas-lattes',
  /** Alteração de evento de ouvinte, com o formulário de eventos no contrato (src/bridge/edit-items.ts). */
  'alterar-evento',
] as const;

export type BridgeFeature = (typeof BRIDGE_FEATURES)[number];

export type Compat =
  | { kind: 'ok' }
  /** O outro lado não tem o que este tem: ele é que precisa atualizar. */
  | { kind: 'outro-antigo'; missing: string[] }
  /** O outro lado tem o que este não conhece: este é que precisa atualizar. */
  | { kind: 'este-antigo'; unknown: string[] };

/**
 * Compara as capacidades deste lado com as que o outro anunciou. Sem lista
 * (versões de antes deste aperto de mão), o outro não tem nenhuma.
 */
export function compareFeatures(
  mine: readonly string[],
  theirs: readonly string[] | undefined,
): Compat {
  const other = new Set(theirs ?? []);
  const missing = mine.filter((f) => !other.has(f));
  if (missing.length) return { kind: 'outro-antigo', missing };
  const known = new Set(mine);
  const unknown = [...other].filter((f) => !known.has(f));
  return unknown.length ? { kind: 'este-antigo', unknown } : { kind: 'ok' };
}

/**
 * O aviso do painel da extensão quando ela e o app não combinam; nada sem app
 * ligado ou com os dois em dia. Um app de antes do aperto de mão com
 * capacidades não manda versão nem lista, e conta como mais antigo.
 */
export function versionNotice(
  extensionVersion: string,
  app: { features?: string[]; version?: string } | undefined,
): string | undefined {
  if (!app) return undefined;
  const appLabel = app.version ? `O app LattesEditor (v${app.version})` : 'O app LattesEditor';
  const compat = compareFeatures(BRIDGE_FEATURES, app.features);
  if (compat.kind === 'outro-antigo') {
    return `${appLabel} é mais antigo que esta extensão (v${extensionVersion}) e não usa tudo o que ela faz. Baixe a versão nova do app.`;
  }
  if (compat.kind === 'este-antigo') {
    return `Esta extensão (v${extensionVersion}) é mais antiga que o app${app.version ? ` (v${app.version})` : ''}. Atualize a extensão.`;
  }
  return undefined;
}
