import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { saveBytes } from '../desktop/native.ts';
import { NewItemPicker } from '../forms/NewItemPicker.tsx';
import { ProductionForm } from '../forms/ProductionForm.tsx';
import { type Session, useProduction } from '../forms/use-production.ts';
import { ExportPanel } from '../import-export/ExportPanel.tsx';
import { encodeCv, loadCv, maxSequenciaProducao } from '../model/document.ts';
import { importableTypes } from '../model/production.ts';
import {
  clearAll,
  type HistoryEntry,
  listHistory,
  loadWorkingCopy,
  newWorkingCopy,
  replaceWorkingCopy,
  saveWorkingCopy,
} from '../model/store.ts';
import { getAttr, parseXml, serializeXml, walk, type XElement } from '../model/xml.ts';
import { PrintDialog } from '../print/PrintDialog.tsx';
import { usePrint } from '../print/use-print.ts';
import { lattesSchema } from '../schema/lattes.ts';
import { CommandPalette } from './CommandPalette.tsx';
import { copyFileName } from './copy-name.ts';
import { HistoryDialog, ReloadConfirm } from './dialogs.tsx';
import { EditorContext } from './editor-context.ts';
import { type HashRoute, parseHash, writeHash } from './hash-route.ts';
import { paletteActions, paletteEntries, type PaletteEntry } from './palette-search.ts';
import { PendingBanner } from './PendingBanner.tsx';
import { profileOf } from './profile.ts';
import { ReferenceContext } from './reference-context.ts';
import { buildReferenceIndex, type ReferenceIndex } from './reference-tables.ts';
import { buildSections } from './sections.ts';
import { SectionView } from './SectionView.tsx';
import { Sidebar } from './Sidebar.tsx';
import { statusStrip } from './status-strip.ts';
import { useTheme } from './theme.ts';
import { type SaveState, Topbar } from './Topbar.tsx';
import { useBridge } from './use-bridge.ts';
import { useChanges } from './use-changes.ts';
import { usePaletteShortcut } from './use-palette-shortcut.ts';
import { Welcome } from './Welcome.tsx';

const AUTOSAVE_MS = 400;
const EMPTY_INDEX: ReferenceIndex = { courses: new Map(), institutions: new Map() };

export function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [booting, setBooting] = useState(true);
  const [version, setVersion] = useState(0);
  const [saveState, setSaveState] = useState<SaveState>('salvo');
  const [error, setError] = useState<string | null>(null);
  const [sectionId, setSectionId] = useState('dados-gerais');
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [showEmpty, setShowEmpty] = useState(false);
  const [theme, setTheme] = useTheme();
  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [reloadFile, setReloadFile] = useState<File | null>(null);
  const pendingNotes = useRef<string[]>([]);
  const pendingAnchor = useRef<string | null>(null);
  const topbarRef = useRef<HTMLElement>(null);

  // Publica a altura do cabeçalho em --topbar-h; o que gruda embaixo dele usa a variável.
  useEffect(() => {
    const bar = topbarRef.current;
    if (!bar) return;
    // Cabeçalho desmontado (troca de tela, recarga do código) mede 0; não publica.
    const observer = new ResizeObserver(() => {
      if (bar.offsetHeight > 0) {
        document.documentElement.style.setProperty('--topbar-h', `${bar.offsetHeight}px`);
      }
    });
    observer.observe(bar);
    return () => observer.disconnect();
  }, [session]);

  // Restaura a cópia de trabalho da última sessão.
  useEffect(() => {
    loadWorkingCopy()
      .then((copy) => {
        if (copy) {
          const { savedAt: _savedAt, xml, ...meta } = copy;
          // Cópias salvas antes do marco 2 não tinham o máximo da exportação.
          const loadedMaxSequencia =
            meta.loadedMaxSequencia ?? maxSequenciaProducao(parseXml(meta.originalXml));
          setSession({ doc: parseXml(xml), meta: { ...meta, loadedMaxSequencia } });
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

  const production = useProduction(session, setSession, version, onEdit);
  // Data da exportação carregada, lida uma vez por arquivo.
  const originalXml = session?.meta.originalXml;
  const exportedOn = useMemo(
    () => (originalXml ? getAttr(parseXml(originalXml).root, 'DATA-ATUALIZACAO') : undefined),
    [originalXml],
  );

  // O documento é mutado no lugar; `version` é o que avisa que ele mudou.
  const sections = useMemo(
    () => (session ? buildSections(session.doc.root) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [session, version],
  );
  const entries = useMemo(() => [...paletteEntries(sections), ...paletteActions()], [sections]);
  const referenceIndex = useMemo(
    () => (session ? buildReferenceIndex(session.doc.root) : undefined),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [session, version],
  );
  const section = sections.find((s) => s.id === sectionId) ?? sections[0];
  const sectionsRef = useRef(sections);
  sectionsRef.current = sections;
  const changes = useChanges(session, sections, version, onEdit, setSession);
  const bridge = useBridge(session, changes.groups, changes.accept, changes.reopen);

  const togglePalette = useCallback(() => session && setPaletteOpen((o) => !o), [session]);
  usePaletteShortcut(togglePalette);
  const print = usePrint(session !== null);

  /** Vai para a seção (e o grupo ou ano) e mantém a URL legível em sincronia. */
  const navigate = useCallback((route: HashRoute, write = true) => {
    setSectionId(route.sectionId);
    pendingAnchor.current = route.anchor ?? null;
    if (!route.anchor) window.scrollTo({ top: 0 });
    if (write) writeHash(route);
  }, []);

  // Um link "#atuacao/atuacao-profissional/2020", aberto ou editado à mão, leva direto lá.
  const hasSections = sections.length > 0;
  useEffect(() => {
    if (!hasSections) return;
    const follow = () => {
      const route = parseHash(location.hash);
      if (route && sectionsRef.current.some((s) => s.id === route.sectionId))
        navigate(route, false);
    };
    follow();
    window.addEventListener('hashchange', follow);
    return () => window.removeEventListener('hashchange', follow);
  }, [hasSections, navigate]);

  const jump = (entry: PaletteEntry) => {
    if (entry.action) {
      if (entry.action === 'exportar') setExportOpen(true);
      else if (entry.action === 'novo') setPickerOpen(true);
      else {
        const itemName = entry.action.slice('novo:'.length);
        const type = importableTypes(lattesSchema).find((t) => t.itemName === itemName);
        if (type) production.startNew(type);
      }
      return;
    }
    navigate({ anchor: entry.anchorId, sectionId: entry.sectionId });
  };

  // Rola até o grupo escolhido no ⌘K depois que a seção renderiza.
  useEffect(() => {
    const anchor = pendingAnchor.current;
    if (!anchor) return;
    pendingAnchor.current = null;
    const el = document.getElementById(anchor);
    el?.scrollIntoView({ block: 'start' });
  });

  const openFile = async (file: File) => {
    setError(null);
    try {
      const cv = await loadCv(new Uint8Array(await file.arrayBuffer()), file.name);
      const copy = newWorkingCopy(cv, Date.now());
      await replaceWorkingCopy(copy);
      const { savedAt: _savedAt, xml: _xml, ...meta } = copy;
      setSession({ doc: cv.doc, meta });
      setSectionId('dados-gerais');
      setSaveState('salvo');
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const saveFile = () => {
    if (!session) return;
    void saveBytes(encodeCv(session.doc, session.meta.encoding), session.meta.fileName);
  };

  /** Nova exportação do Lattes: itens novos que ainda não foram importados se perdem. */
  const reload = (file: File) => {
    if (production.pending.length > 0) setReloadFile(file);
    else void openFile(file);
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

  const saveHistoryCopy = (entry: HistoryEntry) => {
    if (!session) return;
    void saveBytes(
      encodeCv(parseXml(entry.xml), session.meta.encoding),
      copyFileName(session.meta.fileName, new Date(entry.savedAt)),
    );
  };

  const closeFile = async () => {
    await clearAll();
    setSession(null);
    setVersion(0);
  };

  if (booting) return null;

  if (!session) {
    return <Welcome error={error} theme={theme} onFile={openFile} onTheme={setTheme} />;
  }

  const modified = serializeXml(session.doc) !== session.meta.originalXml;
  const pendingIn = countPendingIn(production.pending);
  const exportFile = exportOpen ? production.buildFile() : undefined;
  const openExport = () => setExportOpen(true);
  const profile = profileOf(session.doc, session.meta.fileName, exportedOn);

  return (
    <div className="shell">
      <Topbar
        ref={topbarRef}
        modified={modified}
        pendingCount={production.pending.length + changes.open}
        saveState={saveState}
        showEmpty={showEmpty}
        strip={statusStrip({
          editorChanges: production.pending.length + changes.open,
          lattes: bridge.lattes,
          sent: bridge.sent,
        })}
        theme={theme}
        onClose={closeFile}
        onExport={openExport}
        onHistory={openHistory}
        onNewItem={() => setPickerOpen(true)}
        onPalette={togglePalette}
        onPrint={print.show}
        onReload={reload}
        onSave={saveFile}
        onShowEmpty={setShowEmpty}
        onStripOpen={(kind) => {
          openExport();
          if (kind === 'no-lattes') scrollToSent();
        }}
        onTheme={setTheme}
      />

      <Sidebar
        activeId={section?.id}
        pendingIn={pendingIn}
        profile={profile}
        sections={sections}
        onSelect={(id) => navigate({ sectionId: id })}
      />

      <main className="content">
        <EditorContext.Provider
          value={{ loadedMax: production.loadedMax, openItem: production.openItem }}
        >
          <ReferenceContext.Provider value={referenceIndex ?? EMPTY_INDEX}>
            <PendingBanner
              changes={changes.open}
              news={production.pending.length}
              onOpen={openExport}
            />
            {error && <p className="error">{error}</p>}
            {section && (
              <SectionView
                section={section}
                showEmpty={showEmpty}
                onEdit={onEdit}
                onNewItem={production.startNew}
                onOpenPicker={() => setPickerOpen(true)}
              />
            )}
          </ReferenceContext.Provider>
        </EditorContext.Provider>
      </main>

      <CommandPalette entries={entries} open={paletteOpen} onClose={closePalette} onSelect={jump} />

      {production.form && (
        <ProductionForm
          key={`${production.form.sequencia}-${production.form.isNew}`}
          isNew={production.form.isNew}
          item={production.form.item}
          knownAreas={production.areas}
          knownAuthors={production.authors}
          sequencia={production.form.sequencia}
          onCancel={production.cancel}
          onRemove={production.form.isNew ? undefined : production.remove}
          onSave={production.save}
        />
      )}

      <NewItemPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={(type, work) => {
          setPickerOpen(false);
          production.startNew(type, work);
        }}
      />

      <ExportPanel
        bridge={bridge}
        changes={changes.groups}
        file={exportFile}
        open={exportOpen}
        pending={production.summaries}
        onClose={() => setExportOpen(false)}
        onDiscard={changes.discard}
        onDiscardField={changes.discardField}
        onDownload={() => exportFile && void saveBytes(exportFile.bytes, exportFile.fileName)}
        onOpenItem={(seq) => {
          setExportOpen(false);
          production.openItem(seq);
        }}
      />

      <ReloadConfirm
        file={reloadFile}
        pending={production.summaries}
        onCancel={() => setReloadFile(null)}
        onConfirm={(file) => {
          setReloadFile(null);
          void openFile(file);
        }}
      />

      <PrintDialog control={print} doc={session.doc} profile={profile} sections={sections} />

      <HistoryDialog
        entries={history}
        open={historyOpen}
        onClose={closeHistory}
        onRestore={restore}
        onSave={saveHistoryCopy}
      />
    </div>
  );
}

/** O registro do enviado fica no fim de "Levar ao Lattes"; espera o painel abrir. */
/** Rola até "Enviado ao Lattes" quando ele aparecer: o painel abre e a lista carrega depois. */
function scrollToSent(frames = 30): void {
  const el = document.getElementById('enviado-ao-lattes');
  if (el) el.scrollIntoView({ block: 'start' });
  else if (frames > 0) requestAnimationFrame(() => scrollToSent(frames - 1));
}

/** Conta, dentro de alguns elementos, quantos dos itens pendentes aparecem. */
function countPendingIn(pending: XElement[]): (els: XElement[]) => number {
  const set = new Set(pending);
  return (els) => {
    let n = 0;
    for (const el of els) walk(el, (node) => void (set.has(node) && n++));
    return n;
  };
}
