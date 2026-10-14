import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { LattesStatus } from '../bridge/lattes-status.ts';
import type { Link } from '../bridge/link.ts';
import type { SentEntry } from '../bridge/sent-log.ts';
import { useDevExtensionFolder } from '../desktop/dev-channel.ts';
import { saveBytes } from '../desktop/native.ts';
import type { UpdateState } from '../desktop/update.ts';
import { NewItemPicker } from '../forms/NewItemPicker.tsx';
import { ProductionForm } from '../forms/ProductionForm.tsx';
import { type Session, useProduction } from '../forms/use-production.ts';
import { ExportPanel } from '../import-export/ExportPanel.tsx';
import { requestTab } from '../import-export/send-routes.ts';
import { encodeCv, loadCv, maxSequenciaProducao } from '../model/document.ts';
import { importableTypes } from '../model/production.ts';
import {
  clearAll,
  loadWorkingCopy,
  newWorkingCopy,
  replaceWorkingCopy,
  saveWorkingCopy,
  storageStatus,
} from '../model/store.ts';
import { parseXml, serializeXml, walk, type XElement } from '../model/xml.ts';
import { PrintDialog } from '../print/PrintDialog.tsx';
import { usePrint } from '../print/use-print.ts';
import { DiagnosisPanel } from '../review/DiagnosisPanel.tsx';
import { lattesSchema } from '../schema/lattes.ts';
import { CommandPalette } from './CommandPalette.tsx';
import { HistoryDialog, ReloadConfirm } from './dialogs.tsx';
import { EditorContext } from './editor-context.ts';
import { parseHash } from './hash-route.ts';
import { connectionOf, noticesFor } from './notifications.ts';
import { paletteActions, paletteEntries, type PaletteEntry } from './palette-search.ts';
import { PendingBanner } from './PendingBanner.tsx';
import { profileOf } from './profile.ts';
import { ReferenceContext } from './reference-context.ts';
import { buildReferenceIndex, type ReferenceIndex } from './reference-tables.ts';
import { buildSections } from './sections.ts';
import { SectionView } from './SectionView.tsx';
import { Sidebar } from './Sidebar.tsx';
import { statusStrip } from './status-strip.ts';
import { StorageNotice } from './StorageNotice.tsx';
import { useTheme } from './theme.ts';
import { type SaveState, Topbar } from './Topbar.tsx';
import { useBridge } from './use-bridge.ts';
import { useChanges } from './use-changes.ts';
import { useHistoryDialog } from './use-history-dialog.ts';
import { useLattesOpen } from './use-lattes-open.ts';
import { useNavigate } from './use-navigate.ts';
import { usePaletteShortcut } from './use-palette-shortcut.ts';
import { usePhotoChange } from './use-photo-change.tsx';
import { useTopbarHeight } from './use-topbar-height.ts';
import { useUpdates } from './use-updates.ts';
import { useVersions } from './use-versions.ts';
import { exportDateOf } from './version-diff.ts';
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
  const [pickerOpen, setPickerOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [diagnosisOpen, setDiagnosisOpen] = useState(false);
  const [reloadFile, setReloadFile] = useState<File | null>(null);
  const pendingNotes = useRef<string[]>([]);
  const pendingAnchor = useRef<string | null>(null);
  const topbarRef = useRef<HTMLElement>(null);

  useTopbarHeight(topbarRef, session);
  const update = useUpdates();

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
  const exportedOn = useMemo(() => exportDateOf(originalXml), [originalXml]);

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
  const photoChange = usePhotoChange(bridge);
  const devExtensionFolder = useDevExtensionFolder();

  const togglePalette = useCallback(() => session && setPaletteOpen((o) => !o), [session]);
  usePaletteShortcut(togglePalette);
  const print = usePrint(session !== null);

  /** Vai para a seção (e o grupo ou ano) e mantém a URL legível em sincronia. */
  const navigate = useNavigate(sectionId, setSectionId, pendingAnchor);
  const versions = useVersions(session?.doc.root, navigate);

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
      else if (entry.action === 'diagnostico') setDiagnosisOpen(true);
      else if (entry.action === 'novo') setPickerOpen(true);
      else if (entry.action === 'versoes') void versions.show();
      else startNewItem(entry.action, production.startNew);
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
      // A linha do tempo é auxiliar: se não gravar, o currículo abre igual.
      void versions.record(cv.doc.root, copy.originalXml).catch((e: unknown) => console.warn(e));
      const { savedAt: _savedAt, xml: _xml, ...meta } = copy;
      setSession({ doc: cv.doc, meta });
      setSectionId('dados-gerais');
      setSaveState('salvo');
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const lattesOpen = useLattesOpen(!session && !booting, bridge, (file) => void openFile(file));

  const saveFile = () => {
    if (!session) return;
    void saveBytes(encodeCv(session.doc, session.meta.encoding), session.meta.fileName);
  };

  /** Nova exportação do Lattes: itens novos que ainda não foram importados se perdem. */
  const reload = (file: File) => {
    if (production.pending.length > 0) setReloadFile(file);
    else void openFile(file);
  };

  const closePalette = useCallback(() => setPaletteOpen(false), []);
  const history = useHistoryDialog(session, (doc, note) => {
    if (!session) return;
    setSession({ doc, meta: session.meta });
    onEdit(note);
  });

  const closeFile = async () => {
    await clearAll();
    setSession(null);
    setVersion(0);
  };

  if (booting) return null;

  const storageNotice = <StorageNotice {...storageStatus()} onReset={closeFile} />;

  if (!session) {
    return (
      <>
        <Welcome
          error={error}
          lattes={lattesOpen}
          link={bridge.link}
          theme={theme}
          onFile={openFile}
          onReloadLattes={bridge.reloadLattes}
          onTheme={setTheme}
        />
        {storageNotice}
      </>
    );
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
        notices={noticesOf(bridge, update, devExtensionFolder)}
        pendingCount={production.pending.length + changes.open}
        saveState={saveState}
        showEmpty={showEmpty}
        strip={stripFor(production.pending.length + changes.open, bridge)}
        theme={theme}
        onClose={closeFile}
        onExport={openExport}
        onHistory={() => void history.show()}
        onNewItem={() => setPickerOpen(true)}
        onPalette={togglePalette}
        onPrint={print.show}
        onReload={reload}
        onSave={saveFile}
        onShowEmpty={setShowEmpty}
        onStripOpen={(kind) => {
          if (kind === 'pendencia-desconhecida') return setDiagnosisOpen(true);
          if (kind === 'no-lattes') requestTab('enviado');
          openExport();
        }}
        onTheme={setTheme}
      />

      <Sidebar
        activeId={section?.id}
        pendingIn={pendingIn}
        photoVersion={photoChange.version}
        profile={profile}
        sections={sections}
        onChangePhoto={photoChange.open}
        onSelect={(id) => navigate({ sectionId: id })}
      />
      {photoChange.dialog}

      <main className="content">
        <EditorContext.Provider
          value={{ loadedMax: production.loadedMax, openItem: production.openItem }}
        >
          <ReferenceContext.Provider value={referenceIndex ?? EMPTY_INDEX}>
            {versions.banner}
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

      <DiagnosisPanel
        available={bridge.available}
        espelho={bridge.espelho}
        lattes={bridge.lattes}
        open={diagnosisOpen}
        originalXml={session.meta.originalXml}
        root={session.doc.root}
        sections={sections}
        version={version}
        onClose={() => setDiagnosisOpen(false)}
        onGo={navigate}
        onRequestEspelho={bridge.requestEspelho}
      />

      <PrintDialog control={print} doc={session.doc} profile={profile} sections={sections} />

      <HistoryDialog
        entries={history.entries}
        open={history.open}
        onClose={history.close}
        onRestore={history.restore}
        onSave={history.saveCopy}
      />
      {versions.dialog}
      {storageNotice}
    </div>
  );
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

/** A faixa do cabeçalho: alterações do editor, mais o que o conector sabe do Lattes. */
function stripFor(editorChanges: number, bridge: { lattes?: LattesStatus; sent: SentEntry[] }) {
  return statusStrip({ editorChanges, lattes: bridge.lattes, sent: bridge.sent });
}

/** O sino: por que o Lattes não foi lido, um lado desatualizado, armazenamento sem chave. */
function noticesOf(
  bridge: { lattes?: LattesStatus; link: Link },
  update: UpdateState,
  devExtensionFolder?: string,
) {
  return noticesFor({
    appVersion: __APP_VERSION__,
    connection: connectionOf(bridge.link, Boolean(bridge.lattes)),
    devExtensionFolder,
    storage: storageStatus().status,
    update,
  });
}

/** Ação "novo:<item>" do ⌘K: abre o formulário daquele tipo de item. */
function startNewItem(
  action: string,
  start: (type: ReturnType<typeof importableTypes>[number]) => void,
): void {
  const itemName = action.slice('novo:'.length);
  const type = importableTypes(lattesSchema).find((t) => t.itemName === itemName);
  if (type) start(type);
}
