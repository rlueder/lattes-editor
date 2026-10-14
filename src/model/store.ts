// Cópia de trabalho, histórico e registro do que foi enviado ao Lattes, no
// IndexedDB. Nada sai da máquina, e nada fica legível no disco: o conteúdo de
// cada registro vai cifrado (seal.ts), com a chave do chaveiro do sistema.
// Ficam em claro só o que os índices e a rotação usam: ids, datas, a marca
// `keep` do histórico, o NUMERO-IDENTIFICADOR (público), o `undoOf` e a data e
// a hora da exportação de cada versão (DATA-ATUALIZACAO, HORA-ATUALIZACAO).
//
// Sem chave, o editor não grava nada (modo "só nesta sessão"): guardar o
// currículo em claro seria pior que perder o trabalho não enviado.

import Dexie, { type Table } from 'dexie';

import type { SentEntry } from '../bridge/sent-log.ts';
import { type LoadedCv, maxSequenciaProducao } from './document.ts';
import { isSealed, seal, type Sealed, unseal } from './seal.ts';
import { serializeXml } from './xml.ts';

export interface WorkingCopy {
  encoding: string;
  fileName: string;
  id: 'current';
  loadedAt: number;
  /** Maior SEQUENCIA-PRODUCAO da exportação carregada; acima dele, item novo. */
  loadedMaxSequencia: number;
  /** Próximo SEQUENCIA-PRODUCAO livre: começa em max + 1 e só cresce (guia, 3.2). */
  nextSequencia: number;
  /** XML como foi carregado, para comparar e para "descartar alterações". */
  originalXml: string;
  savedAt: number;
  /** XML serializado (string Unicode). */
  xml: string;
}

export interface HistoryEntry {
  id?: number;
  /**
   * Ponto de antes de um envio ao Lattes: fica fora da rotação das edições
   * (KEPT_LIMIT próprio), para não sumir depois de 50 edições.
   */
  keep?: boolean;
  /** Descrição curta da alteração, mostrada no painel de histórico. */
  note: string;
  savedAt: number;
  xml: string;
}

/** Cópia de trabalho de um arquivo recém-carregado: a numeração do servidor vale a partir daqui (guia, 3.2). */
export function newWorkingCopy(cv: LoadedCv, now: number): WorkingCopy {
  const xml = serializeXml(cv.doc);
  const max = maxSequenciaProducao(cv.doc);
  return {
    encoding: cv.encoding,
    fileName: cv.fileName,
    id: 'current',
    loadedAt: now,
    loadedMaxSequencia: max,
    nextSequencia: max + 1,
    originalXml: xml,
    savedAt: now,
    xml,
  };
}

/**
 * Uma exportação do Lattes como foi aberta: a linha do tempo de versões
 * (LAT-12). Cada abertura ou "Recarregar do Lattes" guarda uma, para mostrar
 * o que mudou de uma exportação para a outra.
 */
export interface LattesVersion {
  /** DATA-ATUALIZACAO + HORA-ATUALIZACAO da exportação (DDMMAAAA HHMMSS), quando há. */
  exportedAt?: string;
  id?: number;
  /** NUMERO-IDENTIFICADOR do currículo. */
  lattesId: string;
  loadedAt: number;
  /** XML da exportação, como foi carregado. */
  xml: string;
}

/**
 * Quantas versões ficam por currículo. Para quem exporta uma vez por mês, dois
 * anos; as mais antigas saem primeiro.
 */
export const VERSION_LIMIT = 24;
/** Teto de versões somando todos os currículos, para o banco não crescer sem fim. */
export const VERSION_TOTAL_LIMIT = 72;

export const HISTORY_LIMIT = 50;
/** Quantos pontos de antes do envio ficam, à parte das edições. */
export const KEPT_LIMIT = 20;

/** Linhas como ficam no banco. Sem `sealed`, é uma linha antiga, em claro. */
interface WorkingRow extends Partial<Omit<WorkingCopy, 'id'>> {
  id: 'current';
  sealed?: Sealed;
}
interface HistoryRow extends Partial<Pick<HistoryEntry, 'note' | 'xml'>> {
  id?: number;
  keep?: boolean;
  savedAt: number;
  sealed?: Sealed;
}
interface VersionRow {
  /**
   * SHA-256 do XML, em claro: compara a exportação nova com a última sem
   * decifrar nada, dentro da transação. Só confirma um XML exato que alguém
   * já tenha; não revela o conteúdo.
   */
  digest?: string;
  exportedAt?: string;
  id?: number;
  lattesId: string;
  loadedAt: number;
  sealed: Sealed;
}
interface SentRow extends Partial<Pick<SentEntry, 'change' | 'op' | 'outcome' | 'rows'>> {
  id?: number;
  lattesId: string;
  sealed?: Sealed;
  sentAt: number;
  undoOf?: number;
}

class LattesDb extends Dexie {
  /** As listas do Lattes lidas pelo conector (src/model/list-cache.ts). */
  lists!: Table<{ name: string; readAt: number; sealed: Sealed }, string>;
  working!: Table<WorkingRow, 'current'>;
  history!: Table<HistoryRow, number>;
  sent!: Table<SentRow, number>;
  versions!: Table<VersionRow, number>;

  constructor() {
    super('lattes-editor');
    this.version(1).stores({ history: '++id, savedAt', working: 'id' });
    // Versão 2 só acrescenta o registro do que foi gravado no Lattes; as
    // tabelas da versão 1 ficam como estão.
    this.version(2).stores({
      history: '++id, savedAt',
      sent: '++id, lattesId, sentAt',
      working: 'id',
    });
    // Versão 3 só acrescenta as versões do Lattes (linha do tempo); nasce
    // cifrada, então não há o que migrar.
    this.version(3).stores({
      history: '++id, savedAt',
      sent: '++id, lattesId, sentAt',
      versions: '++id, lattesId, loadedAt',
      working: 'id',
    });
    // Versão 4 só acrescenta as listas do Lattes (cifradas desde o início).
    this.version(4).stores({
      history: '++id, savedAt',
      lists: 'name',
      sent: '++id, lattesId, sentAt',
      versions: '++id, lattesId, loadedAt',
      working: 'id',
    });
  }
}

export const db = new LattesDb();

/**
 * cifrado: chave em mãos, tudo é gravado cifrado.
 * sem-chave: o chaveiro não respondeu; nada é gravado nesta sessão.
 * chave-perdida: há dados cifrados com outra chave (o chaveiro foi apagado);
 * nada é lido nem gravado até a pessoa decidir começar de novo.
 */
export type StorageStatus = 'cifrado' | 'chave-perdida' | 'sem-chave';

let key: CryptoKey | undefined;
let pendingKey: CryptoKey | undefined;
let status: StorageStatus = 'sem-chave';
let unavailableReason: string | undefined;

export function storageStatus(): { reason?: string; status: StorageStatus } {
  return { reason: unavailableReason, status };
}

/** O chaveiro não respondeu: o editor segue, sem gravar nada. */
export function markStorageUnavailable(reason: string): StorageStatus {
  key = undefined;
  pendingKey = undefined;
  status = 'sem-chave';
  unavailableReason = reason;
  return status;
}

/**
 * A chave abre o banco? Testa algumas linhas de cada tabela e só conclui que
 * a chave é outra se nenhuma abrir: uma linha corrompida sozinha não pode
 * levar a "Apagar e recomeçar" com a chave certa.
 */
async function readable(k: CryptoKey): Promise<boolean> {
  const working = (await db.working.get('current'))?.sealed;
  const samples = [
    ...(working ? [working] : []),
    ...(
      await db.history
        .filter((r) => isSealed(r.sealed))
        .limit(3)
        .toArray()
    ).map((r) => r.sealed!),
    ...(
      await db.sent
        .filter((r) => isSealed(r.sealed))
        .limit(3)
        .toArray()
    ).map((r) => r.sealed!),
    ...(await db.versions.limit(3).toArray()).map((r) => r.sealed),
  ];
  if (samples.length === 0) return true;
  for (const sample of samples) {
    try {
      await unseal(k, sample);
      return true;
    } catch {
      // Tenta a próxima.
    }
  }
  return false;
}

/** Cifra as linhas que ficaram em claro (de antes da cifra) e apaga o texto aberto. */
async function migratePlaintext(k: CryptoKey): Promise<void> {
  const working = (await db.working.toArray()).filter((r) => !r.sealed);
  const history = (await db.history.toArray()).filter((r) => !r.sealed);
  const sent = (await db.sent.toArray()).filter((r) => !r.sealed);
  if (working.length + history.length + sent.length === 0) return;
  const sealedWorking = await Promise.all(
    working.map(async ({ id, ...rest }) => ({ id, sealed: await seal(k, rest) })),
  );
  const sealedHistory = await Promise.all(
    history.map(async ({ id, keep, note, savedAt, xml }) => ({
      id,
      keep,
      savedAt,
      sealed: await seal(k, { note, xml }),
    })),
  );
  const sealedSent = await Promise.all(
    sent.map(async ({ change, id, lattesId, op, rows, sentAt, undoOf }) => ({
      id,
      lattesId,
      sealed: await seal(k, { change, op, rows }),
      sentAt,
      undoOf,
    })),
  );
  // put substitui a linha inteira: o texto aberto some junto.
  await db.transaction('rw', db.working, db.history, db.sent, async () => {
    await db.working.bulkPut(sealedWorking);
    await db.history.bulkPut(sealedHistory);
    await db.sent.bulkPut(sealedSent);
  });
}

/**
 * Abre o banco com a chave: confere que ela lê o que já está cifrado e cifra
 * o que ainda estiver em claro. Com outra chave, fica em "chave-perdida".
 */
export async function openStorage(k: CryptoKey): Promise<StorageStatus> {
  unavailableReason = undefined;
  if (!(await readable(k))) {
    key = undefined;
    pendingKey = k;
    status = 'chave-perdida';
    return status;
  }
  await migratePlaintext(k);
  key = k;
  pendingKey = undefined;
  status = 'cifrado';
  return status;
}

/** Chave perdida: apaga tudo o que não dá mais para ler e segue com a chave nova. */
export async function resetStorage(): Promise<void> {
  if (!pendingKey) return;
  await db.transaction('rw', [db.working, db.history, db.sent, db.versions, db.lists], async () => {
    await db.working.clear();
    await db.history.clear();
    await db.sent.clear();
    await db.versions.clear();
    await db.lists.clear();
  });
  key = pendingKey;
  pendingKey = undefined;
  status = 'cifrado';
}

/**
 * Decifra uma linha; se ela não abre (gravação interrompida, registro
 * corrompido), avisa no console e segue sem ela, em vez de derrubar a lista
 * inteira. Chave errada para o banco todo é outro caso, tratado em
 * openStorage.
 */
async function unsealRow<T>(k: CryptoKey, sealed: Sealed, what: string): Promise<T | undefined> {
  try {
    return await unseal<T>(k, sealed);
  } catch (err) {
    console.warn(`Uma linha de ${what} não pôde ser lida e ficou de fora:`, err);
    return undefined;
  }
}

export async function loadWorkingCopy(): Promise<WorkingCopy | undefined> {
  if (!key) return undefined;
  const row = await db.working.get('current');
  if (!row?.sealed) return undefined;
  const copy = await unsealRow<Omit<WorkingCopy, 'id'>>(key, row.sealed, 'cópia de trabalho');
  return copy && { ...copy, id: 'current' };
}

async function workingRow(k: CryptoKey, copy: WorkingCopy): Promise<WorkingRow> {
  const { id: _id, ...rest } = copy;
  return { id: 'current', sealed: await seal(k, rest) };
}

async function historyRow(k: CryptoKey, entry: Omit<HistoryEntry, 'id'>): Promise<HistoryRow> {
  const { keep, note, savedAt, xml } = entry;
  return { keep, savedAt, sealed: await seal(k, { note, xml }) };
}

/**
 * Apaga os pontos mais antigos: das edições, além dos últimos 50; dos de
 * antes do envio, além dos últimos 20. Uma contagem não come a outra.
 */
async function trimHistory(): Promise<void> {
  const all = await db.history.orderBy('savedAt').toArray();
  const stale = (entries: HistoryRow[], limit: number) =>
    entries.slice(0, Math.max(0, entries.length - limit)).map((e) => e.id!);
  await db.history.bulkDelete([
    ...stale(
      all.filter((e) => !e.keep),
      HISTORY_LIMIT,
    ),
    ...stale(
      all.filter((e) => e.keep),
      KEPT_LIMIT,
    ),
  ]);
}

// A cifra roda antes de cada transação: o IndexedDB fecha a transação quando
// ela espera por algo que não é do próprio banco, como o crypto.subtle.

/** Grava a cópia de trabalho e um ponto de histórico, mantendo os últimos 50. */
export async function saveWorkingCopy(copy: WorkingCopy, note: string): Promise<void> {
  if (!key) return;
  const working = await workingRow(key, copy);
  const point = await historyRow(key, { note, savedAt: copy.savedAt, xml: copy.xml });
  await db.transaction('rw', db.working, db.history, async () => {
    await db.working.put(working);
    await db.history.add(point);
    await trimHistory();
  });
}

/** Um ponto de histórico sem mexer na cópia de trabalho (o de antes de cada envio). */
export async function addHistoryPoint(entry: Omit<HistoryEntry, 'id'>): Promise<void> {
  if (!key) return;
  const point = await historyRow(key, entry);
  await db.transaction('rw', db.history, async () => {
    await db.history.add(point);
    await trimHistory();
  });
}

/** Novo arquivo carregado: substitui a cópia de trabalho e zera o histórico. */
export async function replaceWorkingCopy(copy: WorkingCopy): Promise<void> {
  if (!key) return;
  const working = await workingRow(key, copy);
  const point = await historyRow(key, {
    note: 'Arquivo carregado',
    savedAt: copy.savedAt,
    xml: copy.xml,
  });
  await db.transaction('rw', db.working, db.history, async () => {
    await db.history.clear();
    await db.working.put(working);
    await db.history.add(point);
  });
}

export async function listHistory(): Promise<HistoryEntry[]> {
  const k = key;
  if (!k) return [];
  const rows = await db.history.orderBy('savedAt').reverse().toArray();
  const entries = await Promise.all(
    rows
      .filter((r) => r.sealed)
      .map(async ({ id, keep, savedAt, sealed }) => {
        const open = await unsealRow<Pick<HistoryEntry, 'note' | 'xml'>>(k, sealed!, 'histórico');
        return open && { ...open, id, keep, savedAt };
      }),
  );
  return entries.filter((e) => e !== undefined);
}

/** Grava no registro do que foi enviado ao Lattes; devolve o id. */
export async function addSent(entry: SentEntry): Promise<number | undefined> {
  if (!key) return undefined;
  const { change, id: _id, lattesId, op, outcome, rows, sentAt, undoOf } = entry;
  // O resultado vai cifrado junto: o detalhe de uma divergência traz valores do currículo.
  return db.sent.add({
    lattesId,
    sealed: await seal(key, { change, op, outcome, rows }),
    sentAt,
    undoOf,
  });
}

/** O que foi gravado no Lattes para este currículo, do mais recente ao mais antigo. */
export async function listSent(lattesId: string): Promise<SentEntry[]> {
  const k = key;
  if (!k) return [];
  const rows = await db.sent.where('lattesId').equals(lattesId).toArray();
  const entries = await Promise.all(
    rows
      .filter((r) => r.sealed)
      .map(async ({ id, sealed, sentAt, undoOf }) => {
        const open = await unsealRow<Pick<SentEntry, 'change' | 'op' | 'outcome' | 'rows'>>(
          k,
          sealed!,
          'registro do enviado',
        );
        return open && { ...open, id, lattesId, sentAt, undoOf };
      }),
  );
  return entries.filter((e) => e !== undefined).sort((a, b) => b.sentAt - a.sentAt);
}

/**
 * Guarda uma exportação na linha do tempo do currículo. Uma exportação igual
 * à última guardada (o mesmo arquivo aberto de novo) não vira versão nova.
 * Mantém as últimas VERSION_LIMIT. Devolve se gravou.
 */
async function sha256(text: string): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Grava a exportação como versão, se não for igual à última deste currículo,
 * e mantém as últimas VERSION_LIMIT (e VERSION_TOTAL_LIMIT somando todos).
 * Devolve se gravou e o id da versão anterior, para quem quiser comparar
 * decifrar só ela.
 */
export async function addVersion(
  version: Omit<LattesVersion, 'id'>,
): Promise<{ added: boolean; previousId?: number }> {
  const k = key;
  if (!k) return { added: false };
  const { exportedAt, lattesId, loadedAt, xml } = version;
  const digest = await sha256(xml);
  const row: VersionRow = {
    digest,
    exportedAt,
    lattesId,
    loadedAt,
    sealed: await seal(k, { xml }),
  };
  try {
    return await db.transaction('rw', db.versions, async () => {
      const mine = await db.versions.where('lattesId').equals(lattesId).sortBy('loadedAt');
      const latest = mine.at(-1);
      if (latest?.digest === digest) return { added: false };
      const newId = await db.versions.add(row);
      const ids = [...mine.map((r) => r.id!), newId];
      await db.versions.bulkDelete(ids.slice(0, Math.max(0, ids.length - VERSION_LIMIT)));
      // Somando todos os currículos, saem as mais antigas além do teto, mas
      // nunca a recém-gravada nem a anterior a ela, que o resumo vai ler.
      const total = await db.versions.count();
      if (total > VERSION_TOTAL_LIMIT) {
        const keep = new Set([newId, latest?.id]);
        const oldest = (await db.versions.orderBy('loadedAt').primaryKeys())
          .filter((id) => !keep.has(id))
          .slice(0, total - VERSION_TOTAL_LIMIT);
        await db.versions.bulkDelete(oldest);
      }
      return { added: true, previousId: latest?.id };
    });
  } catch (err) {
    // Sem espaço (quota) ou falha do banco: a linha do tempo fica sem esta
    // versão, mas abrir o currículo não pode depender dela.
    console.warn('Versão do Lattes não gravou:', err);
    return { added: false };
  }
}

/** Uma versão pelo id, decifrada. */
export async function getVersion(id: number): Promise<LattesVersion | undefined> {
  const k = key;
  const row = k ? await db.versions.get(id) : undefined;
  if (!k || !row) return undefined;
  const open = await unsealRow<Pick<LattesVersion, 'xml'>>(k, row.sealed, 'versões do Lattes');
  const { exportedAt, lattesId, loadedAt } = row;
  return open && { ...open, exportedAt, id, lattesId, loadedAt };
}

/** As versões do currículo, da mais recente à mais antiga; `limit` lê só as primeiras. */
/** As versões do currículo, sem o XML (nada é decifrado), da mais recente à mais antiga. */
export async function listVersionInfo(lattesId: string): Promise<Omit<LattesVersion, 'xml'>[]> {
  if (!key) return [];
  const rows = await db.versions.where('lattesId').equals(lattesId).sortBy('loadedAt');
  return rows
    .reverse()
    .map(({ exportedAt, id, loadedAt }) => ({ exportedAt, id, lattesId, loadedAt }));
}

export async function listVersions(lattesId: string, limit?: number): Promise<LattesVersion[]> {
  const k = key;
  if (!k) return [];
  const rows = (await db.versions.where('lattesId').equals(lattesId).sortBy('loadedAt'))
    .reverse()
    .slice(0, limit);
  const versions = await Promise.all(
    rows.map(async ({ exportedAt, id, loadedAt, sealed }) => {
      const open = await unsealRow<Pick<LattesVersion, 'xml'>>(k, sealed, 'versões do Lattes');
      return open && { ...open, exportedAt, id, lattesId, loadedAt };
    }),
  );
  return versions.filter((v) => v !== undefined);
}

/** Apaga a linha do tempo deste currículo. A cópia de trabalho fica como está. */
export async function clearVersions(lattesId: string): Promise<void> {
  await db.versions.where('lattesId').equals(lattesId).delete();
}

/** Apaga o registro do enviado deste currículo. Não muda nada no Lattes. */
export async function clearSent(lattesId: string): Promise<void> {
  await db.sent.where('lattesId').equals(lattesId).delete();
}

/**
 * Fecha o arquivo: apaga a cópia de trabalho e o histórico de edição. O
 * registro do que foi enviado fica: as gravações continuam pendentes no
 * Lattes até "Enviar ao CNPq", e o registro é o único jeito de vê-las e
 * desfazê-las, inclusive depois de abrir outra exportação. As versões do
 * Lattes também ficam: a linha do tempo é justamente entre aberturas.
 */
export async function clearAll(): Promise<void> {
  await db.transaction('rw', db.working, db.history, async () => {
    await db.working.clear();
    await db.history.clear();
  });
}

/** A chave do banco nesta sessão, para as tabelas que vivem em outro módulo. */
export const storageKey = (): CryptoKey | undefined => key;
