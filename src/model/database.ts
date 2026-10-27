// Estrutura do IndexedDB e tipos dos registros. O acesso com cifra fica em store.ts.

import Dexie, { type Table } from 'dexie';

import type { SentEntry } from '../bridge/sent-log.ts';
import type { FormReadMark } from './form-read.ts';
import type { Sealed } from './seal.ts';

export interface WorkingCopy {
  encoding: string;
  fileName: string;
  id: 'current';
  /**
   * Itens lidos dos formulários do Lattes ("Atualizar do Lattes",
   * src/model/form-read.ts), e não da exportação; ausente nas cópias de antes.
   */
  lattesForms?: FormReadMark[];
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

export type HistoryInfo = Omit<HistoryEntry, 'xml'>;

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

/** Linhas como ficam no banco. Sem `sealed`, é uma linha antiga, em claro. */
export interface WorkingRow extends Partial<Omit<WorkingCopy, 'id'>> {
  id: 'current';
  sealed?: Sealed;
}
interface HistoryNoteRow {
  id: number;
  keep?: boolean;
  savedAt: number;
  sealed: Sealed;
}

export interface HistoryRow extends Partial<Pick<HistoryEntry, 'note' | 'xml'>> {
  bucket?: number;
  id?: number;
  keep?: boolean;
  savedAt: number;
  sealed?: Sealed;
}
export interface VersionRow {
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
/** O que vai cifrado numa linha do registro do enviado. */
export type SentSealed = Pick<SentEntry, 'change' | 'op' | 'outcome' | 'rows'>;
interface SentRow extends Partial<SentSealed> {
  /** Em claro, como sentAt: só a hora em que a pessoa conferiu no Lattes. */
  checkedAt?: number;
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
  historyNotes!: Table<HistoryNoteRow, number>;
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
    // A lista do histórico decifra só a nota; o XML só abre ao escolher um ponto.
    this.version(5)
      .stores({
        history: '++id, savedAt, [bucket+savedAt]',
        historyNotes: 'id, savedAt',
      })
      .upgrade((tx) =>
        tx
          .table('history')
          .toCollection()
          .modify((row: HistoryRow) => {
            row.bucket = row.keep ? 1 : 0;
          }),
      );
  }
}

export const db = new LattesDb();
