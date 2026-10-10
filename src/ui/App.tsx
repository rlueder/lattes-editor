import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { encodeCv, loadCv, maxSequenciaProducao } from '../model/document.ts';
import {
  clearAll,
  type HistoryEntry,
  listHistory,
  loadWorkingCopy,
  replaceWorkingCopy,
  saveWorkingCopy,
  type WorkingCopy,
} from '../model/store.ts';
import { firstChild, getAttr, parseXml, serializeXml, type XDocument } from '../model/xml.ts';
import { CommandPalette } from './CommandPalette.tsx';
import { DropZone } from './DropZone.tsx';
import { ElementView } from './ElementView.tsx';
import { Modal } from './Modal.tsx';
import { paletteEntries, type PaletteEntry } from './palette-search.ts';
import { buildSections, countItems } from './sections.ts';
import { usePaletteShortcut } from './use-palette-shortcut.ts';

type SaveState = 'salvo' | 'salvando' | 'erro';

interface Session {
  doc: XDocument;
  meta: Omit<WorkingCopy, 'xml' | 'savedAt'>;
}

const AUTOSAVE_MS = 400;

function ownerName(doc: XDocument): string {
  const dg = firstChild(doc.root, 'DADOS-GERAIS');
  return (dg && getAttr(dg, 'NOME-COMPLETO')) || 'Currículo Lattes';
}
const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

export function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [booting, setBooting] = useState(true);
  const [version, setVersion] = useState(0);
  const [saveState, setSaveState] = useState<SaveState>('salvo');
  const [error, setError] = useState<string | null>(null);
  const [sectionId, setSectionId] = useState('dados-gerais');
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [showEmpty, setShowEmpty] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const pendingNotes = useRef<string[]>([]);
  const pendingAnchor = useRef<string | null>(null);

  // Restaura a cópia de trabalho da última sessão.
  useEffect(() => {
    loadWorkingCopy()
      .then((copy) => {
        if (copy) {
          const { savedAt: _savedAt, xml, ...meta } = copy;
          setSession({ doc: parseXml(xml), meta });
        }
      })
      .catch((err: unknown) =>
        setError(`Não foi possível ler a cópia salva no navegador: ${String(err)}`),
      )
      .finally(() => setBooting(false));
  }, []);

  // Autosave: cada edição marca uma versão; grava depois de uma pausa curta.
  useEffect(() => {
    if (!session || version === 0) return;
    setSaveState('salvando');
    const timer = setTimeout(() => {
      const notes = pendingNotes.current.splice(0);
      const note =
        notes.length > 1 ? `${notes.at(-1)} (+${notes.length - 1})` : (notes[0] ?? 'Alteração');
      saveWorkingCopy(
        { ...session.meta, savedAt: Date.now(), xml: serializeXml(session.doc) },
        note,
      )
        .then(() => setSaveState('salvo'))
        .catch(() => setSaveState('erro'));
    }, AUTOSAVE_MS);
    return () => clearTimeout(timer);
  }, [session, version]);

  const onEdit = useCallback((note: string) => {
    pendingNotes.current.push(note);
    setVersion((v) => v + 1);
  }, []);

  // O documento é mutado no lugar; `version` é o que avisa que ele mudou.
  const sections = useMemo(
    () => (session ? buildSections(session.doc.root) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [session, version],
  );
  const entries = useMemo(() => paletteEntries(sections), [sections]);
  const section = sections.find((s) => s.id === sectionId) ?? sections[0];

  const togglePalette = useCallback(() => {
    if (session) setPaletteOpen((o) => !o);
  }, [session]);
  usePaletteShortcut(togglePalette);

  const jump = (entry: PaletteEntry) => {
    setSectionId(entry.sectionId);
    pendingAnchor.current = entry.anchorId ?? null;
    if (!entry.anchorId) window.scrollTo({ top: 0 });
  };

  // Rola até o grupo escolhido no ⌘K depois que a seção renderiza.
  useEffect(() => {
    const anchor = pendingAnchor.current;
    if (!anchor) return;
    pendingAnchor.current = null;
    const el = document.getElementById(anchor);
    if (el) {
      el.scrollIntoView({ block: 'start' });
      el.classList.add('flash');
      setTimeout(() => el.classList.remove('flash'), 900);
    }
  });

  const openFile = async (file: File) => {
    setError(null);
    try {
      const cv = await loadCv(new Uint8Array(await file.arrayBuffer()), file.name);
      const xml = serializeXml(cv.doc);
      const meta = {
        encoding: cv.encoding,
        fileName: cv.fileName,
        id: 'current' as const,
        loadedAt: Date.now(),
        nextSequencia: maxSequenciaProducao(cv.doc) + 1,
        originalXml: xml,
      };
      await replaceWorkingCopy({ ...meta, savedAt: meta.loadedAt, xml });
      setSession({ doc: cv.doc, meta });
      setSectionId('dados-gerais');
      setSaveState('salvo');
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const saveFile = () => {
    if (!session) return;
    const bytes = encodeCv(session.doc, session.meta.encoding);
    const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/xml' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = session.meta.fileName;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const closeHistory = useCallback(() => setHistoryOpen(false), []);
  const closePalette = useCallback(() => setPaletteOpen(false), []);

  const openHistory = async () => {
    setHistory(await listHistory());
    setHistoryOpen(true);
  };

  const restore = (entry: HistoryEntry) => {
    if (!session) return;
    setSession({ doc: parseXml(entry.xml), meta: session.meta });
    pendingNotes.current.push(`Restaurado: ${new Date(entry.savedAt).toLocaleString('pt-BR')}`);
    setVersion((v) => v + 1);
    setHistoryOpen(false);
  };

  const closeFile = async () => {
    await clearAll();
    setSession(null);
    setVersion(0);
  };

  if (booting) return null;

  if (!session) {
    return (
      <main className="welcome">
        <h1>Editor do Currículo Lattes</h1>
        <p>
          Exporte o currículo no Lattes (menu Ferramentas › Exportar), solte o arquivo aqui e edite.
          O arquivo não sai do seu computador.
        </p>
        <DropZone onFile={openFile} />
        {error && <p className="error">{error}</p>}
      </main>
    );
  }

  const modified = serializeXml(session.doc) !== session.meta.originalXml;

  return (
    <div className="shell">
      <header className="topbar">
        <div className="topbar-title">
          <strong>{ownerName(session.doc)}</strong>
          <span className="file-name">{session.meta.fileName}</span>
          <span className={`save-state ${saveState}`} role="status">
            {saveState === 'salvando'
              ? 'salvando…'
              : saveState === 'erro'
                ? 'erro ao salvar no navegador'
                : 'salvo'}
          </span>
        </div>
        <div className="topbar-actions">
          <button className="ghost kbd-hint" type="button" onClick={togglePalette}>
            Ir para… <kbd>{IS_MAC ? '⌘' : 'Ctrl'}</kbd>
            <kbd>K</kbd>
          </button>
          <label className="toggle">
            <input
              checked={showEmpty}
              type="checkbox"
              onChange={(e) => setShowEmpty(e.target.checked)}
            />
            campos vazios
          </label>
          <button className="ghost" type="button" onClick={openHistory}>
            Histórico
          </button>
          <button className="ghost" type="button" onClick={closeFile}>
            Fechar
          </button>
          <button className="primary" type="button" onClick={saveFile}>
            Salvar arquivo{modified ? ' •' : ''}
          </button>
        </div>
      </header>

      <nav aria-label="Seções" className="sidebar">
        <ul>
          {sections.map((s) => {
            const total = s.groups.reduce((n, g) => n + countItems(g), 0);
            return (
              <li key={s.id}>
                <button
                  className={s.id === section?.id ? 'active' : ''}
                  disabled={s.groups.length === 0}
                  type="button"
                  onClick={() => {
                    setSectionId(s.id);
                    window.scrollTo({ top: 0 });
                  }}
                >
                  <span>{s.label}</span>
                  {total > 0 && <span className="count">{total}</span>}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <main className="content">
        {error && <p className="error">{error}</p>}
        {section && (
          <>
            <div className="section-head">
              <h1>{section.label}</h1>
              {!section.importable && (
                <span
                  className="badge"
                  title="O Importar do Lattes ignora esta seção; copie as mudanças à mão no Lattes."
                >
                  não importável no Lattes
                </span>
              )}
            </div>
            {section.groups.length === 0 && <p className="muted">Nada nesta seção.</p>}
            {section.groups.map((g) => (
              <section key={g.id} className="group" id={g.id}>
                <h2>{g.label}</h2>
                {g.elements.map((el, i) => (
                  <ElementView
                    key={`${version}-${i}`}
                    el={el}
                    showEmpty={showEmpty}
                    onEdit={onEdit}
                  />
                ))}
              </section>
            ))}
          </>
        )}
      </main>

      <CommandPalette entries={entries} open={paletteOpen} onClose={closePalette} onSelect={jump} />

      <Modal className="history" label="Histórico" open={historyOpen} onClose={closeHistory}>
        <h2>Histórico (últimos 50)</h2>
        <ul>
          {history.map((h) => (
            <li key={h.id}>
              <span>
                <time>{new Date(h.savedAt).toLocaleString('pt-BR')}</time> {h.note}
              </span>
              <button className="ghost" type="button" onClick={() => restore(h)}>
                Restaurar
              </button>
            </li>
          ))}
        </ul>
      </Modal>
    </div>
  );
}
