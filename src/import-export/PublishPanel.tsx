// "Enviar ao CNPq" (LAT-54): o que vai ser publicado, a conferência do
// currículo, os dados do envio e a declaração do CNPq, com o texto e o link
// do Termo de Uso lidos da própria tela de envio do Lattes.
//
// A caixa da declaração começa desmarcada a cada abertura do painel, não é
// guardada em lugar nenhum e só muda pelo clique da pessoa: a declaração é
// feita sob as penas da lei (arts. 297 a 299 do Código Penal). As regras ficam
// em publish-view.ts; o envio, em src/bridge/publish.ts.

import { useEffect, useId, useMemo, useState } from 'react';

import { requestProblem } from '../bridge/publish.ts';
import { failed } from '../bridge/sent-log.ts';
import { simulatedSendScreen } from '../dev/send-screen-preview.ts';
import { parseXml } from '../model/xml.ts';
import { compareWithLattes } from '../review/lists-diff.ts';
import { AlertIcon, CheckIcon, SpinnerIcon } from '../ui/icons.tsx';
import { Modal } from '../ui/Modal.tsx';
import { unpublishedEntries } from '../ui/status-strip.ts';
import type { BridgeState } from '../ui/use-bridge.ts';
import { type SendScreenReading, usePublish } from '../ui/use-publish.ts';
import { loadChoices, saveChoices } from './publish-memory.ts';
import {
  canReadSendScreen,
  canSendCv,
  checksLine,
  initialForm,
  type PublishAttempt,
  publishBlockers,
  type PublishForm,
  publishRequest,
  publishStatus,
  publishUiEnabled,
  restoredFields,
  SCREEN_TIMEOUT_MS,
  sendScreenStatus,
} from './publish-view.ts';
import { PublishBlockers } from './PublishBlockers.tsx';
import { WhatPublishes } from './WhatPublishes.tsx';

interface Props {
  bridge: BridgeState;
  /**
   * Os achados do diagnóstico do currículo antes de publicar: quantos são, e
   * abrir o diagnóstico. Sem currículo aberto (a tela inicial), não há.
   */
  checks?: { count: number; onOpen: () => void };
  /** Dentro da janela de envio (passo ③), em vez de um modal próprio. */
  inline?: boolean;
  /** NUMERO-IDENTIFICADOR do currículo aberto: a tela e o envio só valem para ele. */
  lattesId?: string;
  open: boolean;
  /**
   * A última exportação aberta, que é a última versão publicada (o Exportar só
   * exporta publicado). Sem ela (a tela inicial), não há comparação de títulos.
   */
  originalXml?: string;
  onClose: () => void;
  /** O menu confirmou a publicação (a tela inicial tenta abrir o currículo de novo). */
  onPublished?: () => void;
}

/** Quantas vezes pedir de novo a tela de envio com a extensão ocupada, e o intervalo. */
const BUSY_RETRIES = 24;
const BUSY_RETRY_MS = 5000;

interface PanelStateProps {
  text: string;
  title: string;
  tone: 'busy' | 'check' | 'ok';
}

/** Um estado que toma o painel: lendo, esperando, enviando ou o resultado. */
function PanelState({ text, title, tone }: PanelStateProps) {
  return (
    <div className={`publish-progress ${tone}`} role="status">
      <span aria-hidden="true" className="publish-progress-icon">
        {tone === 'busy' ? <SpinnerIcon /> : tone === 'ok' ? <CheckIcon /> : <AlertIcon />}
      </span>
      <h3 className="publish-progress-title">{title}</h3>
      <p className="publish-progress-text">{text}</p>
    </div>
  );
}

/**
 * O que toma o painel no lugar do formulário: o envio (andamento ou
 * resultado), ou a tela de envio sendo lida, a extensão ocupada e a leitura
 * que falhou, nessa ordem.
 */
function panelTakeover(
  status: ReturnType<typeof publishStatus>,
  {
    available,
    screen,
    waitingBusy,
  }: {
    available: boolean;
    screen: { problem?: string; waiting: boolean };
    waitingBusy: boolean;
  },
): PanelStateProps | undefined {
  const sendState: PanelStateProps | undefined =
    (status.busy || status.locked || status.done) && status.text
      ? {
          text: status.text,
          title: status.busy
            ? 'Enviando ao CNPq…'
            : status.done
              ? 'Enviado ao CNPq'
              : 'Confira no Lattes',
          tone: status.busy ? 'busy' : status.done ? 'ok' : 'check',
        }
      : undefined;
  // A tela de envio sendo lida, a extensão ocupada ou a leitura que falhou
  // também tomam o painel, no mesmo formato do envio.
  const screenState: PanelStateProps | undefined = waitingBusy
    ? {
        text: 'A extensão está terminando outra tarefa no Lattes. O painel segue sozinho.',
        title: 'Esperando a extensão…',
        tone: 'busy',
      }
    : screen.waiting
      ? { text: 'Só leitura; nada é enviado ainda.', title: 'Lendo a tela de envio…', tone: 'busy' }
      : available && screen.problem
        ? { text: screen.problem, title: 'Não deu para ler a tela de envio', tone: 'check' }
        : undefined;
  return sendState ?? screenState;
}

/** O painel inteiro é remontado a cada abertura: a declaração nunca vem marcada. */
export function PublishPanel(props: Props) {
  const [opening, setOpening] = useState(0);
  // A troca de chave acontece no próprio render em que o painel abre, e não
  // num efeito depois dele: nem um quadro com o estado da abertura anterior.
  const [wasOpen, setWasOpen] = useState(props.open);
  if (props.open !== wasOpen) {
    setWasOpen(props.open);
    if (props.open) setOpening((n) => n + 1);
  }
  return <PublishPanelBody key={opening} {...props} />;
}

function PublishPanelBody(props: Props) {
  const { bridge, checks, inline, lattesId, onClose, onPublished, open, originalXml } = props;
  const cnpq = usePublish(lattesId);
  const enabled = publishUiEnabled(location.search, import.meta.env.DEV);
  const [screenRequest, setScreenRequest] = useState<{ at: number; id: string } | undefined>();
  // O aceite guarda a leitura e o texto que a pessoa marcou. Outra leitura
  // já aparece desmarcada no render, sem esperar o efeito de reinicialização.
  const [acceptedDeclaration, setAcceptedDeclaration] = useState<{
    reading: SendScreenReading;
    text: string;
  }>();
  const [form, setForm] = useState<PublishForm | undefined>();
  /** Os campos que começaram com a escolha da última vez, ditos no painel. */
  const [restored, setRestored] = useState<string[]>([]);
  const [attempt, setAttempt] = useState<PublishAttempt | undefined>();
  const [now, setNow] = useState(() => Date.now());
  const ids = useId();

  // Ao abrir, com a extensão: a tela de envio e a versão atual do Lattes, só leituras.
  // Sem a capacidade enviar-cnpq, o pedido nem sai.
  const { available, features, requestEspelho } = bridge;
  // No `pnpm dev`, ?simular-envio dá uma tela de exemplo, sem extensão.
  const [fake] = useState(simulatedSendScreen);
  const readable = available && canReadSendScreen(features);
  useEffect(() => {
    if (!open || !readable || fake) return;
    setScreenRequest({ at: Date.now(), id: cnpq.requestScreen() });
    requestEspelho();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, readable]);

  const reading = fake ?? (cnpq.screen?.id === screenRequest?.id ? cnpq.screen : undefined);
  const screen = reading?.screen;
  const declared =
    !!screen &&
    !!acceptedDeclaration &&
    acceptedDeclaration.reading === reading &&
    acceptedDeclaration.text === screen.declaration;
  // O formulário começa com o que o Lattes tem, uma vez por leitura; uma
  // leitura nova desmarca a declaração, que valia para o texto de antes.
  useEffect(() => {
    if (!reading) return;
    const start = initialForm(reading.screen, loadChoices(lattesId));
    setForm(start);
    setRestored(restoredFields(reading.screen, start));
    setAcceptedDeclaration(undefined);
  }, [reading, lattesId]);
  // As escolhas ficam guardadas para a próxima abertura, um instante depois da
  // última mudança (não a cada tecla); a prévia do dev não grava nada.
  useEffect(() => {
    if (!form || fake) return;
    const timer = setTimeout(() => saveChoices(lattesId, form), 600);
    return () => clearTimeout(timer);
  }, [form, fake, lattesId]);
  const screenStatus = fake
    ? { waiting: false }
    : sendScreenStatus({ features, now, reading, requestedAt: screenRequest?.at });
  // Sem resposta, o prazo da leitura da tela também passa.
  useEffect(() => {
    if (!screenStatus.waiting || !screenRequest) return;
    const timer = setTimeout(
      () => setNow(Date.now()),
      screenRequest.at + SCREEN_TIMEOUT_MS - Date.now(),
    );
    return () => clearTimeout(timer);
  }, [screenStatus.waiting, screenRequest]);

  // A extensão ocupada com outra tarefa no Lattes (a conferência que roda
  // quando o menu carrega, por exemplo): o painel pede a tela de novo sozinho,
  // até um limite, em vez de pedir para reabrir.
  const [busyTries, setBusyTries] = useState(0);
  const busyNow = reading?.reason === 'ocupado' && busyTries < BUSY_RETRIES;
  useEffect(() => {
    if (!busyNow) return;
    const timer = setTimeout(() => {
      setBusyTries((n) => n + 1);
      setScreenRequest({ at: Date.now(), id: cnpq.requestScreen() });
    }, BUSY_RETRY_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busyNow]);
  const waitingBusy = busyNow || (busyTries > 0 && screenStatus.waiting);

  const status = publishStatus(attempt, cnpq.result, now);
  // Uma vez por envio confirmado: quem abriu o painel pode seguir (a tela inicial
  // tenta abrir o currículo de novo, agora que o Exportar está liberado).
  const published = status.done ? attempt?.id : undefined;
  useEffect(() => {
    if (published) onPublished?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [published]);
  useEffect(() => {
    if (!status.busy || !attempt) return;
    const timer = setTimeout(() => setNow(Date.now()), 1000);
    return () => clearTimeout(timer);
  }, [status.busy, attempt, now]);

  const pending = unpublishedEntries(bridge.sent, bridge.lattes).filter((e) => !failed(e));
  // Freio de escrita (LAT-59): gravação divergente sem conferência bloqueia o envio.
  const blockers = publishBlockers(bridge.sent, bridge.lattes);
  const original = useMemo(
    () => (open && originalXml ? parseXml(originalXml).root : undefined),
    [open, originalXml],
  );
  const diff = useMemo(
    () => (original && bridge.espelho ? compareWithLattes(bridge.espelho, original) : undefined),
    [original, bridge.espelho],
  );

  const request = form && screen && publishRequest(form, declared, screen.declaration);
  const problem = request && requestProblem(request, screen);
  const canSend =
    enabled &&
    available &&
    canSendCv(features) &&
    !fake &&
    !!request &&
    !problem &&
    !status.locked &&
    blockers.length === 0;
  const set = (patch: Partial<PublishForm>) => setForm((f) => f && { ...f, ...patch });

  const send = () => {
    if (!request || !canSend) return;
    const at = Date.now();
    setNow(at);
    setAttempt({ at, id: cnpq.publish(request) });
    // Um envio por declaração: a próxima tentativa pede a marca de novo.
    setAcceptedDeclaration(undefined);
  };

  const sendLabel = inline ? 'Publicar no CNPq' : 'Enviar ao CNPq';
  // Depois do clique em enviar, o andamento e o resultado tomam o painel: o
  // formulário já foi, e a declaração vale só para aquela tentativa.
  const takeover = panelTakeover(status, {
    available: bridge.available,
    screen: screenStatus,
    waitingBusy,
  });
  const body = takeover ? (
    <PanelState {...takeover} />
  ) : (
    <>
      {fake && (
        <p className="muted">Prévia de desenvolvimento: nenhum pedido é enviado ao Lattes.</p>
      )}
      {enabled && bridge.available && !fake && !canSendCv(features) && (
        <p className="export-blocked">Atualize a extensão do conector para publicar pelo app.</p>
      )}
      {!bridge.available && (
        <p className="export-blocked">
          O envio precisa da extensão e do seu currículo aberto no Lattes, neste navegador.
        </p>
      )}

      <WhatPublishes bridge={bridge} diff={diff} pending={pending} previews={reading?.previews} />

      <PublishBlockers blockers={blockers} onCheck={bridge.checkSent} />

      {checks && (
        <section className="panel-section">
          <h3 className="panel-section-head">Antes de publicar</h3>
          <p className="muted">{checksLine(checks.count)}</p>
          {checks.count > 0 && (
            <div className="diagnosis-actions">
              <button type="button" onClick={checks.onOpen}>
                Abrir o diagnóstico
              </button>
            </div>
          )}
        </section>
      )}

      {screen && form && (
        <div className="lattes-form-box">
          <h3 className="lattes-form-head">Tela de envio do Lattes</h3>
          <p className="muted lattes-form-sub">
            Os mesmos campos e a mesma declaração da tela &quot;Enviar&quot; do Lattes.
          </p>
          <section className="panel-section">
            <h3 className="panel-section-head">Dados do envio</h3>
            {restored.length > 0 && (
              <p className="muted">
                Da última vez neste currículo: {restored.join(', ')}. Confira antes de enviar.
              </p>
            )}
            <div className="fields publish-fields">
              <fieldset className="field publish-choices">
                <legend>Idioma principal</legend>
                {(screen.language?.options ?? [{ label: 'Português', value: '1' }]).map((o) => (
                  <label key={o.value}>
                    <input
                      checked={form.language === o.value}
                      disabled={!enabled || !screen.language}
                      name={`${ids}-idioma`}
                      type="radio"
                      value={o.value}
                      onChange={() => set({ language: o.value })}
                    />
                    {o.label}
                  </label>
                ))}
              </fieldset>
              <div className="field publish-choices">
                <span className="field-label">Versão em inglês</span>
                <label>
                  <input
                    checked={form.english}
                    disabled={!enabled || !screen.english}
                    type="checkbox"
                    onChange={(e) => set({ english: e.target.checked })}
                  />
                  {screen.english?.label || 'Autorizo a versão em inglês'}
                </label>
              </div>
              <div className="field">
                <label htmlFor={`${ids}-contato`}>E-mail de contato</label>
                <input
                  id={`${ids}-contato`}
                  readOnly={!enabled}
                  type="email"
                  value={form.emailContact}
                  onChange={(e) => set({ emailContact: e.target.value })}
                />
              </div>
              <div className="field">
                <label htmlFor={`${ids}-alternativo`}>E-mail alternativo</label>
                <input
                  id={`${ids}-alternativo`}
                  readOnly={!enabled}
                  type="email"
                  value={form.emailAlternative}
                  onChange={(e) => set({ emailAlternative: e.target.value })}
                />
              </div>
            </div>
          </section>

          <section className="panel-section">
            <h3 className="panel-section-head">Declaração</h3>
            <blockquote className="publish-declaration">{screen.declaration}</blockquote>
            {enabled && (
              <label className="publish-agree">
                <input
                  checked={declared}
                  disabled={status.locked}
                  type="checkbox"
                  onChange={(e) =>
                    setAcceptedDeclaration(
                      e.target.checked && reading
                        ? { reading, text: screen.declaration }
                        : undefined,
                    )
                  }
                />
                <span>{screen.agree || 'Li e estou de acordo com a declaração acima'}</span>
              </label>
            )}
            <p className="muted">
              Texto lido da tela de envio do Lattes.{' '}
              {screen.terms ? (
                <a className="notice-link" href={screen.terms} rel="noreferrer" target="_blank">
                  Termo de Uso
                </a>
              ) : (
                'O link do Termo de Uso não foi achado na tela; leia-o no Lattes.'
              )}
            </p>
            {!enabled && (
              <p className="muted">
                O envio pelo editor ainda está desligado. No Lattes, use &quot;Enviar&quot;, no
                canto superior direito, e marque esta declaração na tela de envio.
              </p>
            )}
            {enabled && problem && declared && <p className="export-blocked">{problem}</p>}
          </section>
        </div>
      )}

      {status.text && (
        <p className={status.done ? 'publish-done' : 'muted'} role="status">
          {status.text}
        </p>
      )}
    </>
  );
  // No passo ③ da janela de envio (ExportPanel), sem modal: o botão fica no fim.
  if (inline) {
    return (
      <div className="publish-inline">
        {body}
        {enabled && !status.locked && (
          <div className="step-actions">
            <button className="primary" disabled={!canSend} type="button" onClick={send}>
              {sendLabel}
            </button>
          </div>
        )}
      </div>
    );
  }
  return (
    <Modal
      className="export publish"
      footer={
        <>
          <button className="ghost" type="button" onClick={onClose}>
            {status.done || status.locked || !enabled ? 'Fechar' : 'Cancelar'}
          </button>
          {enabled && !status.locked && (
            <button className="primary" disabled={!canSend} type="button" onClick={send}>
              {sendLabel}
            </button>
          )}
        </>
      }
      label="Enviar ao CNPq"
      open={open}
      subtitle="Publica no currículo público o que está gravado no Lattes. Só você marca a declaração."
      title="Enviar ao CNPq"
      onClose={onClose}
    >
      {body}
    </Modal>
  );
}
