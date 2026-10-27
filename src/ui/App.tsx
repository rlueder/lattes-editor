import { useCallback, useMemo, useRef, useState } from 'react';

import { keepPristineBaseline } from '../desktop/backup-folder.ts';
import { useDevExtensionFolder } from '../desktop/dev-channel.ts';
import { saveBytes } from '../desktop/native.ts';
import { GeneralItemDialogs } from '../forms/GeneralItemPicker.tsx';
import { NewItemPicker } from '../forms/NewItemPicker.tsx';
import { ProductionForm } from '../forms/ProductionForm.tsx';
import { useGeneralItem } from '../forms/use-general-item.ts';
import { type Session, useProduction } from '../forms/use-production.ts';
import { ExportPanel } from '../import-export/ExportPanel.tsx';
import { PublishPanel } from '../import-export/PublishPanel.tsx';
import { useIncoming } from '../import-export/use-incoming.tsx';
import type { BackupSource } from '../model/backups.ts';
import { encodeCv, loadCv } from '../model/document.ts';
import { importableTypes } from '../model/production.ts';
import {
  addHistoryPoint,
  clearAll,
  newWorkingCopy,
  replaceWorkingCopy,
  storageStatus,
} from '../model/store.ts';
import { getAttr, serializeXml } from '../model/xml.ts';
import { PrintDialog } from '../print/PrintDialog.tsx';
import { usePrint } from '../print/use-print.ts';
import { DiagnosisPanel } from '../review/DiagnosisPanel.tsx';
import { lattesSchema } from '../schema/lattes.ts';
import { noticesOf, stripFor } from './app-notices.ts';
import { CommandPalette } from './CommandPalette.tsx';
import { HistoryDialog } from './dialogs.tsx';
import { EditorContext } from './editor-context.ts';
import { DEFAULT_SECTION } from './hash-route.ts';
import type { PaletteEntry } from './palette-search.ts';
import { countPendingIn } from './pending-count.ts';
import { PendingBanner } from './PendingBanner.tsx';
import { profileOf } from './profile.ts';
import { ReferenceContext } from './reference-context.ts';
import { buildReferenceIndex, type ReferenceIndex } from './reference-tables.ts';
import { pickerTypes } from './section-types.ts';
import { buildSections, type Section } from './sections.ts';
import { SectionView } from './SectionView.tsx';
import { ShellWithLists } from './ShellWithLists.tsx';
import { Sidebar } from './Sidebar.tsx';
import { StorageNotice } from './StorageNotice.tsx';
import { TestItemsPanel } from './TestItemsPanel.tsx';
import { useTheme } from './theme.ts';
import { Topbar } from './Topbar.tsx';
import { useBridge } from './use-bridge.ts';
import { useChanges } from './use-changes.ts';
import { useFocusShell } from './use-focus-mode.ts';
import { useFormLacksFor } from './use-form-lacks.ts';
import { useHistoryDialog } from './use-history-dialog.ts';
import { useLattesOpen } from './use-lattes-open.ts';
import { useLattesReload } from './use-lattes-reload.ts';
import { useFollowHash, useNavigate, useScrollToPendingAnchor } from './use-navigate.ts';
import { usePaletteShortcut } from './use-palette-shortcut.ts';
import { usePanoramaShell } from './use-panorama-shell.tsx';
import { usePhotoChange } from './use-photo-change.tsx';
import { usePreflight } from './use-preflight.ts';
import { type ReloadArg, useReload } from './use-reload.ts';
import { useOpenStoredVersion } from './use-stored-version.ts';
import { useTopbarHeight } from './use-topbar-height.ts';
import { useUpdates } from './use-updates.ts';
import { useVersions } from './use-versions.ts';
import { useAutosave, useRestoreWorkingCopy } from './use-working-copy.ts';
import { exportDateOf } from './version-diff.ts';

/** O painel dos itens de teste do censo, só em desenvolvimento e com ?itens-teste. */
const TEST_ITEMS_ON =
  import.meta.env.DEV && new URLSearchParams(location.search).has('itens-teste');
import { Welcome } from './Welcome.tsx';

const EMPTY_INDEX: ReferenceIndex = { courses: new Map(), institutions: new Map() };

export function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [version, setVersion] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [sectionId, setSectionId] = useState(DEFAULT_SECTION);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [theme, setTheme] = useTheme();
  // Seletor de tipo de item novo; aberto de uma seção vazia, os tipos dela vêm primeiro.
  const [picker, setPicker] = useState<{ open: boolean; section?: Section }>({ open: false });
  const openPicker = (section?: Section) => setPicker({ open: true, section });
  const [exportOpen, setExportOpen] = useState(false);
  const [diagnosisOpen, setDiagnosisOpen] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
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
  const modified = useMemo(
    () => Boolean(session && serializeXml(session.doc) !== originalXml),
    // O documento é mutado no lugar; version invalida a comparação.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [session, originalXml, version],
  );
  const formLacksFor = useFormLacksFor(originalXml, session?.doc.root);
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
  useFollowHash(sections, navigate);

  const jump = (entry: PaletteEntry) => {
    if (shell.jumpChart(entry)) return;
    if (entry.action) {
      if (entry.action === 'novo') openPicker();
      else startNewItem(entry.action, production.startNew);
      return;
    }
    shell.go({ anchor: entry.anchorId, sectionId: entry.sectionId });
  };

  useScrollToPendingAnchor(pendingAnchor);

  /**
   * reload: um "Recarregar do Lattes", que guarda os pontos marcados do
   * histórico e, com previous, a cópia de trabalho de antes. `origin` diz de
   * onde a exportação veio do Lattes (arquivo ou conector): só então ela pode
   * virar o ponto zero (LAT-59).
   */
  const openFile = async (file: File, reload?: ReloadArg, origin?: BackupSource) => {
    const previous = reload?.previous;
    setError(null);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const cv = await loadCv(bytes, file.name);
      // Ponto zero: a primeira exportação de cada currículo, byte a byte, se
      // for uma exportação do Lattes sem mexer (isBaselineCandidate). Não
      // atrasa nem impede a abertura.
      if (origin) void keepPristineBaseline(cv.doc.root, bytes, file.name, origin);
      const copy = newWorkingCopy(cv, Date.now());
      // A cópia de antes vai para o histórico primeiro: se não gravar, nada é trocado.
      if (previous) await addHistoryPoint({ ...previous, keep: true, savedAt: copy.savedAt - 1 });
      await replaceWorkingCopy(copy, reload !== undefined);
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

  const lattesOpen = useLattesOpen(Boolean(session), booting, bridge, (file) =>
    openFile(file, undefined, 'conector'),
  );

  /** Nova exportação do Lattes: itens novos que ainda não foram importados se perdem. */
  const openVersion = useOpenStoredVersion(openFile, bridge, () => setDiagnosisOpen(true));
  const { dialog: reloadDialog, reload } = useReload(
    session,
    { changes: changes.open, pending: production.summaries },
    openFile,
  );
  const lattesReload = useLattesReload(bridge, cvId(session), (f) => reload(f, 'conector'));

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

  const checks = usePreflight(publishOpen, session?.doc.root, sections, version, () =>
    setDiagnosisOpen(true),
  );

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
          onFile={(file) => void openFile(file, undefined, 'arquivo')}
          onOpenVersion={openVersion}
          onPublish={() => setPublishOpen(true)}
          onReloadLattes={bridge.reloadLattes}
          onTheme={setTheme}
        />
        <PublishPanel
          bridge={bridge}
          lattesId={lattesOpen.state.kind === 'falhou' ? lattesOpen.state.lattesId : undefined}
          open={publishOpen}
          onClose={() => setPublishOpen(false)}
          onPublished={() => {
            setPublishOpen(false);
            lattesOpen.open();
          }}
        />
        {storageNotice}
      </>
    );
  }

  const pendingIn = countPendingIn(production.pending);
  const exportFile = exportOpen ? production.buildFile() : undefined;
  const openExport = () => setExportOpen(true);
  const profile = profileOf(session.doc, session.meta.fileName, exportedOn);

  return (
    <ShellWithLists features={bridge.features} focus={focusShell} formLacks={formLacksFor}>
      {TEST_ITEMS_ON && <TestItemsPanel />}
      <Topbar
        ref={topbarRef}
        focus={focusShell.menuItem}
        modified={modified}
        notices={noticesOf(
          bridge,
          update,
          devExtensionFolder,
          lattesReload.failure,
          getAttr(session.doc.root, 'DATA-ATUALIZACAO'),
        )}
        pendingCount={production.pending.length + changes.open}
        saveState={saveState}
        theme={theme}
        onClose={closeFile}
        onDiagnosis={() => setDiagnosisOpen(true)}
        onExport={openExport}
        onHistory={() => void history.show()}
        onIncoming={incoming.pick}
        onNewItem={() => openPicker()}
        onPalette={togglePalette}
        onPrint={print.show}
        onReload={(file) => reload(file, 'arquivo')}
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
                  key={shell.sectionKey}
                  initialFilter={shell.initialFilter(section.id)}
                  section={section}
                  onEdit={onEdit}
                  onNewGeneral={general.open}
                  onNewItem={production.startNew}
                  onOpenPicker={() => openPicker(section)}
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
          duplicateIn={session.doc.root}
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
        open={picker.open}
        section={picker.section && pickerTypes(lattesSchema, picker.section)}
        // A seção fica enquanto o modal sai de cena: o título não troca no meio da saída.
        onClose={() => setPicker((p) => ({ ...p, open: false }))}
        onPick={(type, work) => {
          setPicker((p) => ({ ...p, open: false }));
          production.startNew(type, work);
        }}
      />

      <ExportPanel
        bridge={bridge}
        changes={changes.groups}
        file={exportFile}
        open={exportOpen}
        pending={production.summaries}
        publish={{
          checks,
          lattesId: getAttr(session.doc.root, 'NUMERO-IDENTIFICADOR'),
          originalXml: session.meta.originalXml,
        }}
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
      />

      {reloadDialog}

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

/** O NUMERO-IDENTIFICADOR do currículo aberto. */
function cvId(session: Session | null): string | undefined {
  return session ? getAttr(session.doc.root, 'NUMERO-IDENTIFICADOR') : undefined;
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
