import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { LattesStatus } from '../bridge/lattes-status.ts';
import type { Link } from '../bridge/link.ts';
import type { SentEntry } from '../bridge/sent-log.ts';
import { useDevExtensionFolder } from '../desktop/dev-channel.ts';
import { saveBytes } from '../desktop/native.ts';
import type { UpdateState } from '../desktop/update.ts';
import { GeneralItemDialogs } from '../forms/GeneralItemPicker.tsx';
import { NewItemPicker } from '../forms/NewItemPicker.tsx';
import { ProductionForm } from '../forms/ProductionForm.tsx';
import { useGeneralItem } from '../forms/use-general-item.ts';
import { type Session, useProduction } from '../forms/use-production.ts';
import { ExportPanel } from '../import-export/ExportPanel.tsx';
import { PublishPanel } from '../import-export/PublishPanel.tsx';
import { useIncoming } from '../import-export/use-incoming.tsx';
import { encodeCv, loadCv } from '../model/document.ts';
import { importableTypes } from '../model/production.ts';
import { clearAll, newWorkingCopy, replaceWorkingCopy, storageStatus } from '../model/store.ts';
import { getAttr, serializeXml, walk, type XElement } from '../model/xml.ts';
import { PrintDialog } from '../print/PrintDialog.tsx';
import { usePrint } from '../print/use-print.ts';
import { reviewCv } from '../review/consistency.ts';
import { closestInCv } from '../review/dedup.ts';
import { DiagnosisPanel } from '../review/DiagnosisPanel.tsx';
import { lattesSchema } from '../schema/lattes.ts';
import { CommandPalette } from './CommandPalette.tsx';
import { HistoryDialog, ReloadConfirm } from './dialogs.tsx';
import { EditorContext } from './editor-context.ts';
import { parseHash } from './hash-route.ts';
import { type ReloadFailure, reloadNotice } from './lattes-reload.ts';
import { connectionOf, noticesFor } from './notifications.ts';
import type { PaletteEntry } from './palette-search.ts';
import { PendingBanner } from './PendingBanner.tsx';
import { profileOf } from './profile.ts';
import { ReferenceContext } from './reference-context.ts';
import { buildReferenceIndex, type ReferenceIndex } from './reference-tables.ts';
import { buildSections } from './sections.ts';
import { SectionView } from './SectionView.tsx';
import { ShellWithLists } from './ShellWithLists.tsx';
import { Sidebar } from './Sidebar.tsx';
import { statusStrip } from './status-strip.ts';
import { StorageNotice } from './StorageNotice.tsx';
import { useTheme } from './theme.ts';
import { Topbar } from './Topbar.tsx';
import { useBridge } from './use-bridge.ts';
import { useChanges } from './use-changes.ts';
import { useFocusShell } from './use-focus-mode.ts';
import { useHistoryDialog } from './use-history-dialog.ts';
import { useLattesOpen } from './use-lattes-open.ts';
import { useLattesReload } from './use-lattes-reload.ts';
import { useNavigate, useScrollToPendingAnchor } from './use-navigate.ts';
import { usePaletteShortcut } from './use-palette-shortcut.ts';
import { usePanoramaShell } from './use-panorama-shell.tsx';
import { usePhotoChange } from './use-photo-change.tsx';
import { useOpenStoredVersion } from './use-stored-version.ts';
import { useTopbarHeight } from './use-topbar-height.ts';
import { useUpdates } from './use-updates.ts';
import { useVersions } from './use-versions.ts';
import { useAutosave, useRestoreWorkingCopy } from './use-working-copy.ts';
import { exportDateOf } from './version-diff.ts';
import { Welcome } from './Welcome.tsx';

const EMPTY_INDEX: ReferenceIndex = { courses: new Map(), institutions: new Map() };

export function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [version, setVersion] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [sectionId, setSectionId] = useState('dados-gerais');
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [theme, setTheme] = useTheme();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [diagnosisOpen, setDiagnosisOpen] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [reloadFile, setReloadFile] = useState<File | null>(null);
  const pendingNotes = useRef<string[]>([]);
  const pendingAnchor = useRef<string | null>(null);
  const topbarRef = useRef<HTMLElement>(null);

  useTopbarHeight(topbarRef, session);
  const focusShell = useFocusShell(paletteOpen, sectionId); // modo foco, com ?leitura
  const update = useUpdates();

  const booting = useRestoreWorkingCopy(setSession, setError);
  const [saveState, setSaveState] = useAutosave(session, version, pendingNotes);

  const onEdit = useCallback((note: string) => {
    pendingNotes.current.push(note);
    setVersion((v) => v + 1);
  }, []);

  const production = useProduction(session, setSession, version, onEdit);
  const general = useGeneralItem(session, setSession, version, onEdit);
  const incoming = useIncoming(session, setSession, onEdit);
  // Data da exportação carregada, lida uma vez por arquivo.
  const originalXml = session?.meta.originalXml;
  const exportedOn = useMemo(() => exportDateOf(originalXml), [originalXml]);

  // O documento é mutado no lugar; `version` é o que avisa que ele mudou.
  const sections = useMemo(
    () => (session ? buildSections(session.doc.root) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [session, version],
  );
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
  // No modo foco, o painel revelado de onde veio a escolha fecha na hora.
  const navigate = useNavigate(sectionId, setSectionId, pendingAnchor, focusShell.onNavigate);
  const shell = usePanoramaShell({ navigate, sectionId, sections, session, version });
  const versions = useVersions(session?.doc.root, shell.go);

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
    if (shell.jumpChart(entry)) return;
    if (entry.action) {
      if (entry.action === 'novo') setPickerOpen(true);
      else startNewItem(entry.action, production.startNew);
      return;
    }
    shell.go({ anchor: entry.anchorId, sectionId: entry.sectionId });
  };

  useScrollToPendingAnchor(pendingAnchor);

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

  const lattesOpen = useLattesOpen(Boolean(session), booting, bridge, openFile);

  /** Nova exportação do Lattes: itens novos que ainda não foram importados se perdem. */
  const openVersion = useOpenStoredVersion(openFile, bridge, () => setDiagnosisOpen(true));
  const lattesReload = useLattesReload(bridge, cvId(session), (file) => reload(file));

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
          onOpenVersion={openVersion}
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
    <ShellWithLists features={bridge.features} focus={focusShell}>
      <Topbar
        ref={topbarRef}
        focus={focusShell.menuItem}
        modified={modified}
        notices={noticesOf(bridge, update, devExtensionFolder, lattesReload.failure)}
        pendingCount={production.pending.length + changes.open}
        saveState={saveState}
        theme={theme}
        onClose={closeFile}
        onDiagnosis={() => setDiagnosisOpen(true)}
        onExport={openExport}
        onHistory={() => void history.show()}
        onIncoming={incoming.pick}
        onNewItem={() => setPickerOpen(true)}
        onPalette={togglePalette}
        onPrint={print.show}
        onReload={reload}
        onReloadFromLattes={lattesReload.available ? lattesReload.start : undefined}
        onSave={() =>
          void saveBytes(encodeCv(session.doc, session.meta.encoding), session.meta.fileName)
        }
        onTheme={setTheme}
        onVersions={() => void versions.show()}
      />

      <Sidebar
        activeId={section?.id}
        modeSwitch={shell.modeSwitch}
        nav={shell.nav}
        pendingIn={pendingIn}
        photoVersion={photoChange.version}
        profile={profile}
        sections={sections}
        onChangePhoto={photoChange.open}
        onSelect={(id) => shell.go({ sectionId: id })}
      />
      {photoChange.dialog}

      <main className="content">
        <EditorContext.Provider
          value={{
            loadedMax: production.loadedMax,
            openItem: production.openItem,
            root: session?.doc.root,
          }}
        >
          <ReferenceContext.Provider value={referenceIndex ?? EMPTY_INDEX}>
            {versions.banner}
            <PendingBanner
              changes={changes.open}
              news={production.pending.length}
              onOpen={openExport}
            />
            {error && <p className="error">{error}</p>}
            {shell.view ??
              (section && (
                <SectionView
                  key={shell.sectionFilter.key}
                  initialFilter={shell.sectionFilter.filter}
                  section={section}
                  onEdit={onEdit}
                  onNewGeneral={general.open}
                  onNewItem={production.startNew}
                  onOpenPicker={() => setPickerOpen(true)}
                />
              ))}
          </ReferenceContext.Provider>
        </EditorContext.Provider>
      </main>

      <CommandPalette
        entries={shell.entries}
        open={paletteOpen}
        onClose={closePalette}
        onSelect={jump}
      />

      {production.form && (
        <ProductionForm
          key={`${production.form.sequencia}-${production.form.isNew}`}
          byChanges={production.formByChanges}
          duplicateOf={(item) => closestInCv(item, session.doc.root)}
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

      <GeneralItemDialogs general={general} sectionLabel={section?.label ?? ''} />

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
        strip={stripFor(production.pending.length + changes.open, bridge)}
        onClose={() => setExportOpen(false)}
        onDiagnosis={() => setDiagnosisOpen(true)}
        onDiscard={changes.discard}
        onDiscardField={changes.discardField}
        onDownload={() => exportFile && void saveBytes(exportFile.bytes, exportFile.fileName)}
        onOpenItem={(seq) => {
          setExportOpen(false);
          production.openItem(seq);
        }}
        onPublish={() => setPublishOpen(true)}
      />

      <PublishPanel
        bridge={bridge}
        checks={preflight(session.doc.root, () => setDiagnosisOpen(true))}
        lattesId={getAttr(session.doc.root, 'NUMERO-IDENTIFICADOR')}
        open={publishOpen}
        originalXml={session.meta.originalXml}
        onClose={() => setPublishOpen(false)}
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
        onGo={shell.go}
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
      {incoming.dialog}
      {storageNotice}
    </ShellWithLists>
  );
}

/**
 * A conferência antes de publicar (LAT-54): quantos achados o diagnóstico do
 * currículo tem, e abri-lo. Provisório: até a LAT-25 chegar à main, conta só
 * os da revisão de consistência; com ela, passa a contar os de validateCv,
 * que o mesmo diagnóstico mostra.
 */
function preflight(root: XElement, onOpen: () => void) {
  return { count: reviewCv(root).length, onOpen };
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

/** O NUMERO-IDENTIFICADOR do currículo aberto. */
function cvId(session: Session | null): string | undefined {
  return session ? getAttr(session.doc.root, 'NUMERO-IDENTIFICADOR') : undefined;
}

/** A faixa do cabeçalho: alterações do editor, mais o que o conector sabe do Lattes. */
function stripFor(editorChanges: number, bridge: { lattes?: LattesStatus; sent: SentEntry[] }) {
  return statusStrip({ editorChanges, lattes: bridge.lattes, sent: bridge.sent });
}

/** O sino: por que o Lattes não foi lido, um lado desatualizado, armazenamento sem chave. */
function noticesOf(
  bridge: { lattes?: LattesStatus; link: Link; sent: SentEntry[] },
  update: UpdateState,
  devExtensionFolder?: string,
  reloadFailure?: ReloadFailure,
) {
  return noticesFor({
    appVersion: __APP_VERSION__,
    connection: connectionOf(bridge.link, Boolean(bridge.lattes)),
    devExtensionFolder,
    reload: reloadFailure && reloadNotice(reloadFailure),
    storage: storageStatus().status,
    unknownPending: stripFor(0, bridge).segments.some((x) => x.kind === 'pendencia-desconhecida'),
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
