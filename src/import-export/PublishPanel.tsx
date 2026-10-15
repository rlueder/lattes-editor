// "Enviar ao CNPq" (LAT-54): o que vai ser publicado, a conferência do
// currículo, os dados do envio e a declaração do CNPq, com o texto e o link
// do Termo de Uso lidos da própria tela de envio do Lattes.
//
// A caixa da declaração começa desmarcada a cada abertura do painel, não é
// guardada em lugar nenhum e só muda pelo clique da pessoa: a declaração é
// feita sob as penas da lei (arts. 297 a 299 do Código Penal). As regras ficam
// em publish-view.ts; o envio, em src/bridge/publish.ts.

import { useEffect, useId, useMemo, useRef, useState } from 'react';

import { requestProblem } from '../bridge/publish.ts';
import { failed } from '../bridge/sent-log.ts';
import { openExternal } from '../desktop/external-links.ts';
import { parseXml } from '../model/xml.ts';
import { diffEspelho } from '../review/espelho-diff.ts';
import { Modal } from '../ui/Modal.tsx';
import { dateLabel, unpublishedEntries } from '../ui/status-strip.ts';
import type { BridgeState } from '../ui/use-bridge.ts';
import { usePublish } from '../ui/use-publish.ts';
import {
  checksLine,
  initialForm,
  type PublishAttempt,
  type PublishForm,
  publishRequest,
  publishStatus,
  publishUiEnabled,
  sendScreenProblem,
} from './publish-view.ts';

interface Props {
  bridge: BridgeState;
  /** A conferência do currículo antes de publicar: quantos pontos, e onde vê-los. */
  checks: { count: number; onOpen: () => void };
  /** NUMERO-IDENTIFICADOR do currículo aberto: a tela e o envio só valem para ele. */
  lattesId?: string;
  open: boolean;
  /** A última exportação aberta, que é a última versão publicada (o Exportar só exporta publicado). */
  originalXml: string;
  onClose: () => void;
}

/** O painel inteiro é remontado a cada abertura: a declaração nunca vem marcada. */
export function PublishPanel(props: Props) {
  const [opening, setOpening] = useState(0);
  const wasOpen = useRef(false);
  useEffect(() => {
    if (props.open && !wasOpen.current) setOpening((n) => n + 1);
    wasOpen.current = props.open;
  }, [props.open]);
  return <PublishPanelBody key={opening} {...props} />;
}

function PublishPanelBody({ bridge, checks, lattesId, onClose, open, originalXml }: Props) {
  const cnpq = usePublish(lattesId);
  const enabled = publishUiEnabled(location.search, import.meta.env.DEV);
  const [screenId, setScreenId] = useState<string | undefined>();
  // A declaração: só o clique da pessoa muda isto, e o painel remontado volta a false.
  const [declared, setDeclared] = useState(false);
  const [form, setForm] = useState<PublishForm | undefined>();
  const [attempt, setAttempt] = useState<PublishAttempt | undefined>();
  const [now, setNow] = useState(() => Date.now());
  const ids = useId();

  // Ao abrir, com a extensão: a tela de envio e a versão atual do Lattes, só leituras.
  const { available, requestEspelho } = bridge;
  useEffect(() => {
    if (!open || !available) return;
    setScreenId(cnpq.requestScreen());
    requestEspelho();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, available]);

  const reading = cnpq.screen?.id === screenId ? cnpq.screen : undefined;
  const screen = reading?.screen;
  // O formulário começa com o que o Lattes tem, uma vez por leitura.
  useEffect(() => {
    if (reading) setForm(initialForm(reading.screen));
  }, [reading]);

  const status = publishStatus(attempt, cnpq.result, now);
  useEffect(() => {
    if (!status.busy || !attempt) return;
    const timer = setTimeout(() => setNow(Date.now()), 1000);
    return () => clearTimeout(timer);
  }, [status.busy, attempt, now]);

  const pending = unpublishedEntries(bridge.sent, bridge.lattes).filter((e) => !failed(e));
  const original = useMemo(
    () => (open ? parseXml(originalXml).root : undefined),
    [open, originalXml],
  );
  const diff = useMemo(
    () =>
      original && bridge.espelho?.items ? diffEspelho(bridge.espelho.items, original) : undefined,
    [original, bridge.espelho],
  );

  const request = form && publishRequest(form, declared);
  const problem = request && requestProblem(request, screen);
  const canSend = enabled && !!request && !problem && !status.busy && !status.done;
  const set = (patch: Partial<PublishForm>) => setForm((f) => f && { ...f, ...patch });

  const send = () => {
    if (!request || !canSend) return;
    const at = Date.now();
    setNow(at);
    setAttempt({ at, id: cnpq.publish(request) });
    // Um envio por declaração: a próxima tentativa pede a marca de novo.
    setDeclared(false);
  };

  return (
    <Modal
      className="export publish"
      footer={
        <>
          <button className="ghost" type="button" onClick={onClose}>
            {status.done || !enabled ? 'Fechar' : 'Cancelar'}
          </button>
          {enabled && !status.done && (
            <button className="primary" disabled={!canSend} type="button" onClick={send}>
              Enviar ao CNPq
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
      {!bridge.available && (
        <p className="export-blocked">
          O envio precisa da extensão e do seu currículo aberto no Lattes, neste navegador.
        </p>
      )}

      <section className="panel-section">
        <h3 className="panel-section-head">O que vai ser publicado</h3>
        <ul className="diagnosis-facts">
          <li>
            Última publicação:{' '}
            <strong>
              {bridge.lattes?.lastPublished
                ? dateLabel(bridge.lattes.lastPublished)
                : 'não informada'}
            </strong>
          </li>
          {pending.length > 0 && (
            <li>
              {pending.length === 1
                ? '1 gravação do editor desde então:'
                : `${pending.length} gravações do editor desde então:`}
              <ul className="diagnosis-lines">
                {pending.map((e, i) => (
                  <li key={e.id ?? i}>{e.op.label}</li>
                ))}
              </ul>
            </li>
          )}
          {bridge.lattes?.pending && pending.length === 0 && (
            <li>Há alterações no Lattes que não passaram pelo editor.</li>
          )}
          {bridge.lattes && !bridge.lattes.pending && pending.length === 0 && (
            <li>O Lattes não mostra nada pendente de publicação.</li>
          )}
        </ul>
        {diff && !diff.unreadable && (
          <p className="muted">
            Comparando os títulos com a última versão publicada:{' '}
            {diff.onlyInLattes.length === 0 && diff.onlyInExport.length === 0
              ? 'nenhuma produção ou evento entra ou sai.'
              : `${[
                  diff.onlyInLattes.length ? `${diff.onlyInLattes.length} entram` : '',
                  diff.onlyInExport.length
                    ? `${diff.onlyInExport.length} saem ou mudam de título`
                    : '',
                ]
                  .filter(Boolean)
                  .join(', ')}.`}
          </p>
        )}
        {diff && diff.onlyInLattes.length > 0 && (
          <ul className="diagnosis-lines">
            {diff.onlyInLattes.map((item, i) => (
              <li key={i}>
                <span className="muted">{item.group ?? item.section}</span> {item.text}
              </li>
            ))}
          </ul>
        )}
        {diff && diff.onlyInExport.length > 0 && (
          <ul className="diagnosis-lines">
            {diff.onlyInExport.map(({ title }, i) => (
              <li key={i}>
                <span className="muted">Sai ou muda de título</span> {title}
              </li>
            ))}
          </ul>
        )}
        {reading?.previews && (
          <div className="publish-previews">
            <button
              type="button"
              onClick={() => reading.previews && openExternal(reading.previews.pt)}
            >
              Ver a versão em português
            </button>
            <button
              type="button"
              onClick={() => reading.previews && openExternal(reading.previews.en)}
            >
              Ver a versão em inglês
            </button>
          </div>
        )}
      </section>

      <section className="panel-section">
        <h3 className="panel-section-head">Antes de publicar</h3>
        <p className="muted">{checksLine(checks.count)}</p>
        {checks.count > 0 && (
          <div className="diagnosis-actions">
            <button type="button" onClick={checks.onOpen}>
              Ver o que conferir
            </button>
          </div>
        )}
      </section>

      {bridge.available && !reading && <p className="muted">Lendo a tela de envio do Lattes…</p>}
      {sendScreenProblem(reading) && <p className="export-blocked">{sendScreenProblem(reading)}</p>}

      {screen && form && (
        <>
          <section className="panel-section">
            <h3 className="panel-section-head">Dados do envio</h3>
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
            {(!screen.language || !screen.english) && (
              <p className="muted">
                A tela do Lattes não mostrou {!screen.language ? 'o idioma' : 'a versão em inglês'}{' '}
                onde o editor procura; vai o que foi visto num envio pelo Lattes.
              </p>
            )}
          </section>

          <section className="panel-section">
            <h3 className="panel-section-head">Declaração</h3>
            {enabled ? (
              <label className="publish-declaration">
                <input
                  checked={declared}
                  disabled={status.busy || status.done}
                  type="checkbox"
                  onChange={(e) => setDeclared(e.target.checked)}
                />
                <span>{screen.declaration}</span>
              </label>
            ) : (
              <blockquote className="publish-declaration">{screen.declaration}</blockquote>
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
        </>
      )}

      {status.text && (
        <p className={status.done ? 'publish-done' : 'muted'} role="status">
          {status.text}
        </p>
      )}
    </Modal>
  );
}
