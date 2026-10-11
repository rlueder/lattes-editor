// Arquivo para o Importar do Lattes (guia, 3.3).
//
// Usa a opção 2: o currículo inteiro com os itens novos. É a única forma
// verificada (10/10/2026). A opção 1, só os itens novos com um DADOS-GERAIS
// mínimo, evitaria a lista vermelha no Passo 3, mas não foi testada; até ser,
// o editor não gera esse formato. Quem importa precisa desmarcar os itens
// vermelhos no Passo 3, e a lista de passos na tela diz isso.

import { encodeCv } from '../model/document.ts';
import { pendingItems } from '../model/production.ts';
import { getAttr, setAttr, type XDocument } from '../model/xml.ts';
import { IMPORT_MODULES, type ImportModule } from './importable.ts';

export interface ImportFile {
  bytes: Uint8Array;
  fileName: string;
  /** Módulos do Passo 2 que têm itens novos: os únicos a deixar marcados. */
  modules: ImportModule[];
  newItems: number;
}

const pad = (n: number, width = 2) => String(n).padStart(width, '0');

/** DATA-ATUALIZACAO (DDMMAAAA) e HORA-ATUALIZACAO (HHMMSS), horário local. */
export function lattesTimestamp(now: Date): { date: string; time: string } {
  return {
    date: `${pad(now.getDate())}${pad(now.getMonth() + 1)}${now.getFullYear()}`,
    time: `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`,
  };
}

/** Módulo do Passo 2 que lê um item, pelo nome do item e do contêiner pai. */
function moduleFor(itemName: string, parentName: string): ImportModule | undefined {
  return IMPORT_MODULES.find((m) =>
    m.paths.some((path) => {
      const segs = path.split('/');
      const last = segs.at(-1)!;
      const container = segs.at(-2);
      if (last === '*') return container === parentName && !m.exclude?.includes(itemName);
      return last === itemName && (container ?? 'CURRICULO-VITAE') === parentName;
    }),
  );
}

export function buildImportFile(
  doc: XDocument,
  encoding: string,
  loadedMax: number,
  now = new Date(),
): ImportFile {
  const copy: XDocument = structuredClone(doc);
  if (getAttr(copy.root, 'SISTEMA-ORIGEM-XML') === undefined) {
    setAttr(copy.root, 'SISTEMA-ORIGEM-XML', 'LATTES_OFFLINE');
  }
  const { date, time } = lattesTimestamp(now);
  setAttr(copy.root, 'DATA-ATUALIZACAO', date);
  setAttr(copy.root, 'HORA-ATUALIZACAO', time);

  // Pai de cada item novo, para achar o módulo.
  const parents = new Map<unknown, string>();
  const visit = (el: XDocument['root']) => {
    for (const c of el.children) {
      if (c.kind !== 'element') continue;
      parents.set(c, el.name);
      visit(c);
    }
  };
  visit(copy.root);

  const pending = pendingItems(copy, loadedMax);
  const modules = new Set<ImportModule>();
  for (const item of pending) {
    const m = moduleFor(item.name, parents.get(item) ?? '');
    if (m) modules.add(m);
  }

  const id = getAttr(copy.root, 'NUMERO-IDENTIFICADOR');
  return {
    bytes: encodeCv(copy, encoding),
    fileName: `${id ?? 'curriculo'}-importacao.xml`,
    modules: IMPORT_MODULES.filter((m) => modules.has(m)),
    newItems: pending.length,
  };
}
