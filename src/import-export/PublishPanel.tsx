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
import { Modal } from '../ui/Modal.tsx';
import { unpublishedEntries } from '../ui/status-strip.ts';
import type { BridgeState } from '../ui/use-bridge.ts';
import { usePublish } from '../ui/use-publish.ts';
import { loadChoices, saveChoices } from './publish-memory.ts';
import {
  canReadSendScreen,
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
  // A declaração: só o clique da pessoa muda isto, e o painel remontado volta a false.
  const [declared, setDeclared] = useState(false);
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
  // O formulário começa com o que o Lattes tem, uma vez por leitura; uma
  // leitura nova desmarca a declaração, que valia para o texto de antes.
  useEffect(() => {
    if (!reading) return;
    const start = initialForm(reading.screen, loadChoices(lattesId));
    setForm(start);
    setRestored(restoredFields(reading.screen, start));
    setDeclared(false);
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
  const canSend = enabled && !!request && !problem && !status.locked && blockers.length === 0;
  const set = (patch: Partial<PublishForm>) => setForm((f) => f && { ...f, ...patch });

  const send = () => {
    if (!request || !canSend) return;
    const at = Date.now();
    setNow(at);
    setAttempt({ at, id: cnpq.publish(request) });
    // Um envio por declaração: a próxima tentativa pede a marca de novo.
    setDeclared(false);
  };

  const sendLabel = inline ? 'Publicar no CNPq' : 'Enviar ao CNPq';
  const body = (
    <>
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

      {screenStatus.waiting && <p className="muted">Lendo a tela de envio do Lattes…</p>}
      {bridge.available && screenStatus.problem && (
        <p className="export-blocked">{screenStatus.problem}</p>
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
                  onChange={(e) => setDeclared(e.target.checked)}
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
            {status.done || !enabled ? 'Fechar' : 'Cancelar'}
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
