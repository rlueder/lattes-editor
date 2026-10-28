// Enviar ao CNPq (LAT-54), sempre contra o Lattes simulado: o envio de
// verdade nunca roda em teste. A declaração marcada aqui é a do simulado, que
// não é o texto do CNPq.

import { afterEach, describe, expect, it, vi } from 'vitest';

import { CONSENT_KEY, consentRecord } from '../extension/src/consent.ts';
import { readSendScreenReply, sendPublish } from '../extension/src/lattes-tab.ts';
import { answerPublishRequest, publishRunning, runPublish } from '../extension/src/publish-run.ts';
import { SIMULATED_EMAIL } from '../scripts/lattes-simulado/estado.ts';
import { SIMULATED_DECLARATION } from '../scripts/lattes-simulado/menu.ts';
import type { Intercept } from '../scripts/lattes-simulado/servidor.ts';
import { BRIDGE_FEATURES } from '../src/bridge/compat.ts';
import { exportCv } from '../src/bridge/export.ts';
import { cvCodeFrom, lattesIdFrom } from '../src/bridge/lattes-html.ts';
import type { BridgeMessage } from '../src/bridge/protocol.ts';
import {
  isPublishRequest,
  localDay,
  missingControls,
  PUBLISH_ENABLED,
  PUBLISH_PACE,
  publishBusy,
  publishCv,
  publishedOn,
  publishMessage,
  type PublishRequest,
  readEmailReply,
  readRaceReply,
  readSendScreen,
  readSendScreenFrom,
  requestProblem,
  SEND_TIMEOUT_MS,
  sendPairs,
  type SendScreen,
  termsLink,
} from '../src/bridge/publish.ts';
import { PUBLISH_REPLY_TIMEOUT_MS, stepsText } from '../src/import-export/publish-view.ts';
import { type LattesSimuladoNoTeste, withLattesSimulado } from './helpers/lattes-simulado.ts';

/** O chrome.tabs.onRemoved dos stubs: nenhuma aba fecha nestes testes (tab-guard.ts). */
const NO_TAB_EVENTS = { addListener: () => undefined, removeListener: () => undefined };

let open: LattesSimuladoNoTeste | undefined;
afterEach(async () => {
  await open?.close();
  open = undefined;
});

async function start(intercept?: Intercept) {
  open = await withLattesSimulado({ intercept });
  // O conector gravou algo: o currículo está com pendência, publicado há dias.
  open.state.touch();
  return open;
}

const TODAY = localDay(new Date());
const noWait = { enabled: true, today: TODAY, verifyAttempts: 2, wait: async () => undefined };

const request = (over: Partial<PublishRequest> = {}): PublishRequest => ({
  declarationAccepted: true,
  declarationText: SIMULATED_DECLARATION,
  emailAlternative: '',
  emailContact: SIMULATED_EMAIL,
  english: true,
  language: '1',
  ...over,
});

const code = async (lattes: LattesSimuladoNoTeste) => cvCodeFrom(await lattes.port.menuHtml());

const procs = (lattes: LattesSimuladoNoTeste) =>
  lattes.state.log.map((l) => `${l.method} ${l.proc.toLowerCase()}`);

const json =
  (proc: string, body: string): Intercept =>
  (req, _state, next) =>
    req.proc.toLowerCase() === proc ? { contentType: 'application/json', html: body } : next();

describe('Enviar ao CNPq pelo conector (LAT-54)', () => {
  it('lê a tela de envio: declaração, Termo de Uso, idioma, versão em inglês e e-mails', async () => {
    const lattes = await start();
    const read = await readSendScreenFrom(lattes.publishPort, await code(lattes));
    expect(read.screen).toEqual({
      agree: 'Li e estou de acordo com a declaração acima',
      declaration: SIMULATED_DECLARATION,
      emailAlternative: '',
      emailContact: SIMULATED_EMAIL,
      english: {
        checked: true,
        label: 'Autorizo a publicação da versão em inglês do meu currículo',
        value: '1',
      },
      language: {
        options: [
          { label: 'Português', value: '1' },
          { label: 'Inglês', value: '2' },
        ],
        selected: '1',
      },
      terms: lattes.at('termo_de_uso_simulado').href,
    });
    // Só leitura: nada além do GET da tela.
    expect(procs(lattes).filter((p) => !p.endsWith('pkg_menu.menu'))).toEqual([
      'GET pkg_publicar.mostrar_cv',
    ]);
  });

  it('envia como a tela, na ordem observada, e confere pelo menu', async () => {
    const lattes = await start();
    expect(lattes.state.pending).toBe(true);
    const before = await exportCv(lattes.exportPort, await code(lattes));
    expect(before).toMatchObject({ ok: false, reason: 'pendente' });

    lattes.state.log.length = 0;
    expect(PUBLISH_ENABLED).toBe(true);
    expect(BRIDGE_FEATURES).toContain('publicar-cnpq');
    // Um relógio que anda 100 ms a cada leitura: cada pedido leva 100 ms.
    let clock = 0;
    const result = await publishCv(lattes.publishPort, await code(lattes), request(), {
      now: () => (clock += 100),
      today: TODAY,
      verifyAttempts: 2,
      wait: noWait.wait,
    });
    // O tempo de cada passo, com os pedidos seguidos do mesmo passo somados.
    expect(result).toEqual({
      lastPublished: TODAY,
      outcome: 'publicado',
      sent: true,
      steps: [
        { ms: 100, step: 'menu' },
        { ms: 100, step: 'tela' },
        { ms: 100, step: 'raca-cor' },
        { ms: 200, step: 'emails' },
        { ms: 100, step: 'envio' },
        { ms: 100, step: 'conferencia' },
      ],
    });
    expect(procs(lattes)).toEqual([
      'GET pkg_menu.menu',
      'GET pkg_menu.menu',
      'GET pkg_publicar.mostrar_cv',
      'POST pkg_publicar.racapreenchida_raca_cor',
      'POST pkg_util.existe_email_cadastrado',
      'POST pkg_util.existe_email_cadastrado',
      'GET pkg_publicar.enviar',
      'GET pkg_menu.menu',
    ]);
    const emails = lattes.state.log
      .filter((l) => l.proc.toLowerCase() === 'pkg_util.existe_email_cadastrado')
      .map((l) => Object.fromEntries(l.pairs ?? []).f_email);
    expect(emails).toEqual([SIMULATED_EMAIL, '']);
    const sent = lattes.state.log.find((l) => l.proc.toLowerCase() === 'pkg_publicar.enviar')!;
    expect(sent.path).toBe(
      `pkg_publicar.enviar?f_chk=1&f_idioma=1&f_chk_en=1&f_email_contato=contato%40example.org&f_email_alternativo=&f_cod=${lattes.state.code}&f_ctr=U`,
    );
    expect(lattes.state.pending).toBe(false);

    const menu = await lattes.port.menuHtml();
    const after = await exportCv(lattes.exportPort, cvCodeFrom(menu), lattesIdFrom(menu));
    expect(after.ok).toBe(true);
  });

  it.each([true, false])(
    'resposta do envio perdida, recebido pelo CNPq: %s, confere sem reenviar',
    async (received) => {
      const lattes = await start();
      const cod = await code(lattes);
      let submissions = 0;
      const port = {
        ...lattes.publishPort,
        get: async (path: string) => {
          if (path.startsWith('pkg_publicar.enviar?')) {
            submissions++;
            if (received) await lattes.publishPort.get(path);
            throw new Error('Resposta perdida');
          }
          return lattes.publishPort.get(path);
        },
      };
      const result = await publishCv(port, cod, request(), noWait);
      expect(result).toMatchObject({
        outcome: received ? 'publicado' : 'nao-confirmado',
        sent: true,
      });
      expect(submissions).toBe(1);
    },
  );

  it.each([false, true])(
    'falha na leitura do menu depois do envio, persistente: %s, não repete o envio',
    async (persistent) => {
      const lattes = await start();
      const cod = await code(lattes);
      let submissions = 0;
      let readFailures = 0;
      const port = {
        ...lattes.publishPort,
        get: async (path: string) => {
          if (path.startsWith('pkg_publicar.enviar?')) submissions++;
          if (path === 'PKG_MENU.menu' && submissions && (persistent || !readFailures)) {
            readFailures++;
            throw new Error('Menu indisponível');
          }
          return lattes.publishPort.get(path);
        },
      };
      const result = await publishCv(port, cod, request(), noWait);
      expect(result).toMatchObject({
        outcome: persistent ? 'nao-confirmado' : 'publicado',
        sent: true,
      });
      expect(submissions).toBe(1);
      expect(readFailures).toBe(persistent ? noWait.verifyAttempts : 1);
    },
  );

  it.each([
    null,
    {},
    { declarationAccepted: true },
    request({ english: 'false' as unknown as boolean }),
    request({ emailContact: 123 as unknown as string }),
    request({ declarationText: null as unknown as string }),
  ])('pedido malformado não causa nenhuma consulta nem envio: %j', async (invalid) => {
    const lattes = await start();
    const cod = await code(lattes);
    lattes.state.log.length = 0;
    expect(isPublishRequest(invalid)).toBe(false);
    expect(
      await publishCv(lattes.publishPort, cod, invalid as PublishRequest, noWait),
    ).toMatchObject({ outcome: 'erro' });
    expect(lattes.state.log).toEqual([]);
  });

  it('sem a declaração marcada pela pessoa, não pede nada ao Lattes', async () => {
    const lattes = await start();
    const cod = await code(lattes);
    lattes.state.log.length = 0;
    const result = await publishCv(
      lattes.publishPort,
      cod,
      request({ declarationAccepted: false }),
      noWait,
    );
    expect(result.outcome).toBe('declaracao');
    expect(lattes.state.log).toEqual([]);
    expect(lattes.state.pending).toBe(true);
  });

  it('o menu relido de outra sessão bloqueia antes de consultar a tela de envio', async () => {
    const lattes = await start();
    const cod = await code(lattes);
    lattes.state.log.length = 0;
    const port = {
      ...lattes.publishPort,
      get: async (path: string) => {
        const response = await lattes.publishPort.get(path);
        return path === 'PKG_MENU.menu'
          ? { ...response, html: response.html.replaceAll(lattes.state.code, 'K000000099') }
          : response;
      },
    };
    expect(await publishCv(port, cod, request(), noWait)).toMatchObject({ outcome: 'outro-cv' });
    expect(procs(lattes)).toEqual(['GET pkg_menu.menu']);
  });

  it('confere o identificador do menu atual mesmo quando o código da sessão é o mesmo', async () => {
    const lattes = await start();
    const cod = await code(lattes);
    lattes.state.log.length = 0;
    expect(
      await publishCv(lattes.publishPort, cod, request(), {
        ...noWait,
        expectedLattesId: '9999999999999999',
      }),
    ).toMatchObject({ outcome: 'outro-cv' });
    expect(procs(lattes)).toEqual(['GET pkg_menu.menu']);
  });

  it('com a identidade confirmada, usa o código do menu atual em vez do DOM anterior', async () => {
    const lattes = await start();
    const cod = await code(lattes);
    const current = 'K000000099';
    const requested: string[] = [];
    const port = {
      get: async (path: string) => {
        requested.push(path);
        const response = await lattes.publishPort.get(path.replaceAll(current, lattes.state.code));
        return path === 'PKG_MENU.menu'
          ? { ...response, html: response.html.replaceAll(lattes.state.code, current) }
          : response;
      },
      post: async (path: string, body: string) => {
        requested.push(`${path}?${body}`);
        return lattes.publishPort.post(path, body.replaceAll(current, lattes.state.code));
      },
    };
    expect(
      await publishCv(port, cod, request(), {
        ...noWait,
        expectedLattesId: lattes.state.lattesId,
      }),
    ).toMatchObject({ outcome: 'publicado', sent: true });
    expect(requested.find((path) => path.startsWith('pkg_publicar.mostrar_cv?'))).toContain(
      `f_cod=${current}`,
    );
    expect(requested.find((path) => path.startsWith('pkg_publicar.enviar?'))).toContain(
      `f_cod=${current}`,
    );
  });

  it('para antes do envio quando a consulta de raça ou cor diz que não', async () => {
    const lattes = await start(json('pkg_publicar.racapreenchida_raca_cor', '{"status": false}'));
    const result = await publishCv(lattes.publishPort, await code(lattes), request(), noWait);
    expect(result.outcome).toBe('raca-cor');
    expect(result.sent).toBeUndefined();
    expect(procs(lattes)).not.toContain('GET pkg_publicar.enviar');
  });

  it('resposta desconhecida da consulta de raça ou cor também para', async () => {
    const lattes = await start(json('pkg_publicar.racapreenchida_raca_cor', '<html>erro</html>'));
    const result = await publishCv(lattes.publishPort, await code(lattes), request(), noWait);
    expect(result.outcome).toBe('mudou');
    expect(procs(lattes)).not.toContain('GET pkg_publicar.enviar');
  });

  it('para antes do envio quando o Lattes diz que o e-mail já existe', async () => {
    const lattes = await start(
      json('pkg_util.existe_email_cadastrado', '{"existe":true ,"mensagem":"Email já cadastrado"}'),
    );
    const result = await publishCv(lattes.publishPort, await code(lattes), request(), noWait);
    expect(result.outcome).toBe('email');
    expect(result.detail).toContain('Email já cadastrado');
    expect(procs(lattes)).not.toContain('GET pkg_publicar.enviar');
  });

  it('consulta de e-mail sem o JSON esperado para', async () => {
    const lattes = await start(json('pkg_util.existe_email_cadastrado', 'ok'));
    const result = await publishCv(lattes.publishPort, await code(lattes), request(), noWait);
    expect(result.outcome).toBe('mudou');
  });

  it('o alerta da resposta não basta: sem o menu confirmar, fica "não confirmado"', async () => {
    const ignored: Intercept = (req, _state, next) =>
      req.proc.toLowerCase() === 'pkg_publicar.enviar'
        ? { html: '<script>alert("O currículo foi enviado para publicação.");</script>' }
        : next();
    const lattes = await start(ignored);
    const result = await publishCv(lattes.publishPort, await code(lattes), request(), noWait);
    expect(result.outcome).toBe('nao-confirmado');
    expect(result.sent).toBe(true);
    expect(result.detail).toMatch(/respondeu que o currículo foi enviado, mas o menu ainda mostra/);
    expect(result.detail).toContain('aviso de alterações não enviadas');
    expect(procs(lattes).filter((p) => p === 'GET pkg_menu.menu').length).toBeGreaterThanOrEqual(2);
  });

  it('sem resposta de envio nem data no menu, diz o que viu', async () => {
    const lattes = await start((req, _state, next) => {
      const proc = req.proc.toLowerCase();
      if (proc === 'pkg_publicar.enviar') return { html: '<p>?</p>' };
      if (proc === 'pkg_menu.menu' && req.method === 'GET' && _state.log.length > 6) {
        return { html: '<p>menu sem datas</p>' };
      }
      return next();
    });
    const result = await publishCv(lattes.publishPort, await code(lattes), request(), noWait);
    expect(result.outcome).toBe('nao-confirmado');
    expect(result.detail).toMatch(/não respondeu como no envio observado, e o menu não mostrou/);
  });

  it('sessão caída: antes do envio, na consulta e depois do envio', async () => {
    let lattes = await start();
    const cod = await code(lattes);
    lattes.state.sessionActive = false;
    expect((await publishCv(lattes.publishPort, cod, request(), noWait)).outcome).toBe('sessao');
    await lattes.close();

    lattes = await start((req, state, next) => {
      if (req.proc.toLowerCase() === 'pkg_publicar.racapreenchida_raca_cor') {
        state.sessionActive = false;
      }
      return next();
    });
    open = lattes;
    expect(
      (await publishCv(lattes.publishPort, await code(lattes), request(), noWait)).outcome,
    ).toBe('sessao');
    await lattes.close();

    lattes = await start(async (req, state, next) => {
      const out = await next();
      if (req.proc.toLowerCase() === 'pkg_publicar.enviar') state.sessionActive = false;
      return out;
    });
    open = lattes;
    const after = await publishCv(lattes.publishPort, await code(lattes), request(), noWait);
    expect(after).toMatchObject({ outcome: 'sessao', sent: true });
  });

  it('a sessão cai na consulta de e-mail', async () => {
    const lattes = await start((req, state, next) => {
      if (req.proc.toLowerCase() === 'pkg_util.existe_email_cadastrado') {
        state.sessionActive = false;
      }
      return next();
    });
    const result = await publishCv(lattes.publishPort, await code(lattes), request(), noWait);
    expect(result.outcome).toBe('sessao');
  });

  it('tela de envio que mudou, ou sem código do currículo, não envia', async () => {
    const lattes = await start((req, _state, next) =>
      req.proc.toLowerCase() === 'pkg_publicar.mostrar_cv' ? { html: '<p>outra tela</p>' } : next(),
    );
    const result = await publishCv(lattes.publishPort, await code(lattes), request(), noWait);
    expect(result.outcome).toBe('mudou');
    expect(procs(lattes)).not.toContain('POST pkg_publicar.racapreenchida_raca_cor');
    expect((await publishCv(lattes.publishPort, undefined, request(), noWait)).outcome).toBe(
      'erro',
    );
  });

  it('o que ainda não foi observado (sem a versão em inglês) não sai daqui', async () => {
    const lattes = await start();
    const result = await publishCv(
      lattes.publishPort,
      await code(lattes),
      request({ english: false }),
      noWait,
    );
    expect(result.outcome).toBe('erro');
    expect(procs(lattes)).not.toContain('POST pkg_publicar.racapreenchida_raca_cor');
  });

  it('sem pendência no menu, não há o que publicar, e nada sai', async () => {
    open = await withLattesSimulado();
    const lattes = open;
    const cod = await code(lattes);
    lattes.state.log.length = 0;
    const result = await publishCv(lattes.publishPort, cod, request(), noWait);
    expect(result.outcome).toBe('nada-a-publicar');
    expect(procs(lattes)).toEqual(['GET pkg_menu.menu']);
  });

  it('publicado mais cedo no mesmo dia e o envio falha: não é "publicado"', async () => {
    const ignored: Intercept = (req, _state, next) =>
      req.proc.toLowerCase() === 'pkg_publicar.enviar' ? { html: '<p>?</p>' } : next();
    open = await withLattesSimulado({ intercept: ignored });
    const lattes = open;
    // Publicado hoje de manhã, e depois o conector gravou de novo.
    lattes.state.publish(new Date());
    lattes.state.touch();
    const result = await publishCv(lattes.publishPort, await code(lattes), request(), noWait);
    expect(result.outcome).toBe('nao-confirmado');
    expect(result.sent).toBe(true);
    expect(lattes.state.pending).toBe(true);
  });

  it('a declaração que a pessoa leu precisa ser a da tela no envio', async () => {
    const lattes = await start();
    const result = await publishCv(
      lattes.publishPort,
      await code(lattes),
      request({ declarationText: 'Uma declaração que a tela não tem mais.' }),
      noWait,
    );
    expect(result.outcome).toBe('mudou');
    expect(procs(lattes)).not.toContain('POST pkg_publicar.racapreenchida_raca_cor');
  });

  it('tela sem o e-mail alternativo ou sem a versão em inglês: "mudou", nada sai', async () => {
    for (const control of ['f_email_alternativo', 'f_chk_en']) {
      const lattes = await start((req, _state, next) =>
        Promise.resolve(next()).then((out) =>
          req.proc.toLowerCase() === 'pkg_publicar.mostrar_cv' && 'html' in out
            ? {
                ...out,
                // Na tela real, o nome vem com ou sem aspas (name=f_chk_en).
                html: out.html.replace(new RegExp(`<input[^>]*name="?${control}"?[^>]*>`), ''),
              }
            : out,
        ),
      );
      const read = await readSendScreenFrom(lattes.publishPort, await code(lattes));
      expect(read.reason).toBe('mudou');
      const result = await publishCv(lattes.publishPort, await code(lattes), request(), noWait);
      expect(result.outcome).toBe('mudou');
      expect(procs(lattes)).not.toContain('GET pkg_publicar.enviar');
      await lattes.close();
      open = undefined;
    }
  });

  it('com a chave desligada, o núcleo não pede nada ao Lattes', async () => {
    const lattes = await start();
    lattes.state.log.length = 0;
    const result = await publishCv(lattes.publishPort, await code(lattes), request(), {
      ...noWait,
      enabled: false,
    });
    expect(result.outcome).toBe('desligado');
    expect(procs(lattes).filter((p) => !p.endsWith('pkg_menu.menu'))).toEqual([]);
  });

  it('menu sem a data da publicação antes do envio: "mudou"', async () => {
    const lattes = await start((req, _state, next) =>
      req.proc.toLowerCase() === 'pkg_menu.menu' && req.method === 'GET'
        ? { html: '<p>menu diferente</p>' }
        : next(),
    );
    const result = await publishCv(lattes.publishPort, 'K4790210P3', request(), noWait);
    expect(result.outcome).toBe('mudou');
  });
});

describe('Enviar ao CNPq: leituras e regras', () => {
  const page = 'https://wwws.cnpq.br/cvlattesweb/pkg_publicar.mostrar_cv?f_cod=X';

  it('a declaração vem do texto ao lado da caixa, ou do rótulo antes dela', () => {
    const after = readSendScreen(
      `<form name="publicar"><input type="checkbox" name="f_chk" value="1"> Um texto de declaração comprido o bastante</form>`,
      page,
    );
    expect(after?.declaration).toBe('Um texto de declaração comprido o bastante');
    const before = readSendScreen(
      `<form name="publicar"><table><tr><td>Declaro algo de verdade, sob as penas da lei:</td><td><input type="checkbox" name="f_chk" value="1"></td></tr></table></form>`,
      page,
    );
    expect(before?.declaration).toBe('Declaro algo de verdade, sob as penas da lei');
    expect(before?.terms).toBeUndefined();
    expect(before?.language).toBeUndefined();
    expect(before?.english).toBeUndefined();
    // Caixa sem texto que pareça declaração: não é a tela esperada.
    expect(
      readSendScreen('<form name="publicar"><input type="checkbox" name="f_chk"> Sim</form>', page),
    ).toBeUndefined();
    expect(readSendScreen('<form name="outro"></form>', page)).toBeUndefined();
  });

  it('a legenda da caixa nunca passa por declaração, e os rótulos do idioma vêm do <label for>', () => {
    // Só a legenda junto da caixa: a tela não é a esperada, nada vai.
    expect(
      readSendScreen(
        `<form name="publicar"><input type="checkbox" name=f_chk value="1">Li e estou de acordo com a declaração acima</form>`,
        page,
      ),
    ).toBeUndefined();
    const screen = readSendScreen(
      `<form name="publicar"><ul><li>Um texto de declaração comprido o bastante,   com   espaços.
<a href="t.html">Termo de   Uso</a>
<input type="checkbox" name=f_chk value="1">Li e estou de acordo com a declaração acima</li>
<li>Pergunta: <input type="radio" name="f_idioma" data-id="b" id="a" value="1"><label data-for="b" for="a"><img src="x.png"></label>
<input type="radio" name="f_idioma" id="b" value="2"><label for="b">Inglês</label></li></ul></form>`,
      page,
    )!;
    expect(screen.declaration).toBe('Um texto de declaração comprido o bastante, com espaços.');
    expect(screen.agree).toBe('Li e estou de acordo com a declaração acima');
    // data-id e data-for não contam: o primeiro rádio não leva o rótulo do segundo, e o
    // <label for> vazio não apaga o rótulo lido; o segundo leva o do seu <label for>.
    const labels = screen.language?.options.map((o) => o.label);
    expect(labels?.[0]).not.toBe('Inglês');
    expect(labels?.[1]).toBe('Inglês');
  });

  it('o link do Termo de Uso, direto ou por script', () => {
    expect(termsLink('<a href="/termo.pdf">Termo de Uso</a>', page)).toBe(
      'https://wwws.cnpq.br/termo.pdf',
    );
    expect(
      termsLink(
        `<a href="javascript:window.open('https://exemplo.cnpq.br/termo.html')">Leia o <b>Termo de Uso</b></a>`,
        page,
      ),
    ).toBe('https://exemplo.cnpq.br/termo.html');
    expect(termsLink(`<a href="javascript:abrir()">Termo de Uso</a>`, page)).toBeUndefined();
    expect(termsLink(`<a href="mailto:x@y">Termo de Uso</a>`, page)).toBeUndefined();
    expect(termsLink(`<a href="http://[x">Termo de Uso</a><a>outro</a>`, page)).toBeUndefined();
  });

  it('o que a pessoa escolheu precisa caber no que a tela tem', () => {
    const bare = readSendScreen(
      `<form name="publicar"><input type="checkbox" name="f_chk" value="1"> ${SIMULATED_DECLARATION} <a href="t.html">Termo de Uso</a></form>`,
      page,
    )!;
    const r = (over: Partial<PublishRequest> = {}) =>
      request({ declarationText: bare.declaration, ...over });
    // Sem os controles do envio na tela, nada vai.
    expect(missingControls(bare)).toEqual([
      'idioma principal',
      'versão em inglês',
      'e-mail de contato',
      'e-mail alternativo',
    ]);
    expect(requestProblem(r(), bare)).toMatch(/não tem idioma principal/);
    const screen: SendScreen = {
      ...bare,
      emailAlternative: '',
      emailContact: SIMULATED_EMAIL,
      english: { checked: true, label: 'Autorizo', value: '1' },
      language: { options: [{ label: 'Português', value: '1' }], selected: '1' },
    };
    expect(missingControls(screen)).toEqual([]);
    expect(requestProblem(r({ declarationText: 'outro texto' }), screen)).toMatch(
      /não é o que você marcou/,
    );
    expect(requestProblem(r({ declarationAccepted: false }), screen)).toMatch(/Marque/);
    expect(requestProblem(r(), undefined)).toMatch(/não leu/);
    expect(requestProblem(r(), { ...screen, terms: undefined })).toMatch(/Termo de Uso/);
    expect(requestProblem(r({ language: '2' }), screen)).toMatch(/idioma/);
    expect(requestProblem(r({ english: false }), screen)).toMatch(/versão em inglês/);
    expect(requestProblem(r({ emailContact: ' ' }), screen)).toMatch(/e-mail/);
    expect(requestProblem(r({ english: 'false' as unknown as boolean }), screen)).toMatch(
      /inválido/,
    );
    expect(requestProblem(r(), screen)).toBeUndefined();
  });

  it('respostas das consultas e os parâmetros do envio', () => {
    expect(readRaceReply('{"status": true}')).toBe(true);
    expect(readRaceReply('{"status": "S"}')).toBeUndefined();
    expect(readEmailReply('{"existe":false ,"mensagem":"Email não encontrado"}')).toEqual({
      exists: false,
      message: 'Email não encontrado',
    });
    expect(readEmailReply('{"existe":true}')).toEqual({ exists: true, message: undefined });
    expect(readEmailReply('{}')).toBeUndefined();
    expect(
      sendPairs('K123456789', request({ emailAlternative: ' b@c.d ' })).map(([k]) => k),
    ).toEqual([
      'f_chk',
      'f_idioma',
      'f_chk_en',
      'f_email_contato',
      'f_email_alternativo',
      'f_cod',
      'f_ctr',
    ]);
  });

  it('a publicação de hoje, sem pendência, é o que confirma', () => {
    const menu = (date: string, pending = false) =>
      `<p>Última publicação: ${date}</p>${pending ? '<p>Existem alterações realizadas em seu currículo que ainda não foram enviadas ao CNPq</p>' : ''}`;
    expect(publishedOn(menu('15/10/2026'), '2026-10-15')).toBe(true);
    expect(publishedOn(menu('15/10/2026', true), '2026-10-15')).toBe(false);
    expect(publishedOn(menu('14/10/2026'), '2026-10-15')).toBe(false);
    expect(localDay(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('mensagens e a trava contra outra gravação em andamento', () => {
    const idle = {
      importing: false,
      photo: false,
      publishing: false,
      queue: false,
      verifying: false,
    };
    expect(publishBusy(idle)).toBeUndefined();
    expect(publishBusy({ ...idle, queue: true })?.outcome).toBe('erro');
    for (const outcome of [
      'publicado',
      'consentimento',
      'sem-aba',
      'sessao',
      'outro-cv',
      'desligado',
      'erro',
    ] as const) {
      expect(publishMessage({ outcome })).toBeTruthy();
    }
    expect(publishMessage({ detail: 'x', outcome: 'email' })).toBe('x');
  });
});

describe('Enviar ao CNPq no service worker (extensão)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function stubChrome({
    consent = true,
    fila,
    result,
    tabs = [{ id: 3 }],
  }: {
    consent?: boolean;
    fila?: { ops: []; results: object; running: boolean; verificando?: boolean };
    result?: unknown;
    tabs?: { id?: number }[];
  } = {}) {
    const executeScript = vi.fn(async (opts: { args?: unknown[] }) =>
      opts.args ? [{ result }] : [],
    );
    vi.stubGlobal('chrome', {
      scripting: { executeScript },
      storage: {
        local: { get: async () => (consent ? { [CONSENT_KEY]: consentRecord() } : {}) },
        session: { get: async () => ({ fila: fila ?? undefined }) },
      },
      tabs: { onRemoved: NO_TAB_EVENTS, query: async () => tabs },
    });
    return executeScript;
  }

  const CALL = { id: 'e1', lattesId: '1', request: request(), today: '2026-10-15' };
  const IDLE = { importing: false, photo: false, queue: false, verifying: false };
  const io = (busy = false) => {
    const sent: BridgeMessage[] = [];
    return { busy: async () => busy, send: async (m: BridgeMessage) => void sent.push(m), sent };
  };

  it('desligado: responde "desligado" sem tocar na aba', async () => {
    const exec = stubChrome();
    const reply = vi.fn(async () => undefined);
    expect(await runPublish(CALL, IDLE, reply, false)).toBe(false);
    expect(reply).toHaveBeenCalledWith({
      id: 'e1',
      result: expect.objectContaining({ outcome: 'desligado' }),
      type: 'publicacao',
    });
    expect(exec).not.toHaveBeenCalled();
  });

  it('sem a declaração marcada, nem com a chave ligada chega à aba', async () => {
    const exec = stubChrome();
    const reply = vi.fn(async () => undefined);
    const call = { ...CALL, request: request({ declarationAccepted: false }) };
    expect(await runPublish(call, IDLE, reply, true)).toBe(false);
    expect(reply).toHaveBeenCalledWith(
      expect.objectContaining({ result: expect.objectContaining({ outcome: 'declaracao' }) }),
    );
    expect(exec).not.toHaveBeenCalled();
  });

  it('uma declaração marcada num pedido incompleto também não chega à aba', async () => {
    const exec = stubChrome();
    const reply = vi.fn(async () => undefined);
    const call = { ...CALL, request: { declarationAccepted: true } as PublishRequest };
    expect(await runPublish(call, IDLE, reply, true)).toBe(false);
    expect(reply).toHaveBeenCalledWith(
      expect.objectContaining({ result: expect.objectContaining({ outcome: 'erro' }) }),
    );
    expect(exec).not.toHaveBeenCalled();
  });

  it('ligado: roda na aba com o pedido e o currículo do editor; ocupado, recusa', async () => {
    const exec = stubChrome({ result: { lastPublished: '2026-10-15', outcome: 'publicado' } });
    const reply = vi.fn(async () => undefined);
    expect(await runPublish(CALL, IDLE, reply)).toBe(true);
    expect(reply).toHaveBeenCalledWith({
      id: 'e1',
      result: { lastPublished: '2026-10-15', outcome: 'publicado' },
      type: 'publicacao',
    });
    expect(publishRunning()).toBe(false);
    const call = exec.mock.calls.find(([o]) => o.args)![0] as { args: [string, string[]] };
    expect(call.args[0]).toBe('publicar');
    expect(JSON.parse(call.args[1][0]!)).toEqual({ request: request(), today: '2026-10-15' });
    expect(call.args[1][1]).toBe('1');

    for (const busy of [
      { photo: true },
      { queue: true },
      { verifying: true },
      { importing: true },
    ]) {
      expect(await runPublish(CALL, { ...IDLE, ...busy }, reply, true)).toBe(false);
      expect(reply).toHaveBeenLastCalledWith(
        expect.objectContaining({ result: expect.objectContaining({ outcome: 'erro' }) }),
      );
    }
  });

  it('dois pedidos juntos: o segundo é recusado enquanto o primeiro roda', async () => {
    let release: () => void = () => undefined;
    const executeScript = vi.fn(async (opts: { args?: unknown[] }) => {
      if (!opts.args) return [];
      await new Promise<void>((resolve) => (release = resolve));
      return [{ result: { outcome: 'publicado' } }];
    });
    vi.stubGlobal('chrome', {
      scripting: { executeScript },
      storage: {
        local: { get: async () => ({ [CONSENT_KEY]: consentRecord() }) },
        session: { get: async () => ({}) },
      },
      tabs: { onRemoved: NO_TAB_EVENTS, query: async () => [{ id: 3 }] },
    });
    const outcomes: string[] = [];
    const reply = async (m: { result: { outcome: string } }) =>
      void outcomes.push(m.result.outcome);
    const first = runPublish(CALL, IDLE, reply, true);
    await vi.waitFor(() => expect(publishRunning()).toBe(true));
    expect(await runPublish(CALL, IDLE, reply, true)).toBe(false);
    await vi.waitFor(() => expect(executeScript.mock.calls.some(([o]) => o.args)).toBe(true));
    release();
    expect(await first).toBe(true);
    expect(outcomes).toEqual(['erro', 'publicado']);
  });

  it('o estado guardado não lê: responde "erro" e nada vai à aba', async () => {
    const executeScript = vi.fn(async () => []);
    vi.stubGlobal('chrome', {
      scripting: { executeScript },
      storage: {
        local: { get: async () => ({ [CONSENT_KEY]: consentRecord() }) },
        session: { get: async () => Promise.reject(new Error('sem estado')) },
      },
      tabs: { onRemoved: NO_TAB_EVENTS, query: async () => [{ id: 3 }] },
    });
    const reply = vi.fn(async () => undefined);
    expect(await runPublish(CALL, IDLE, reply, true)).toBe(false);
    expect(reply).toHaveBeenCalledWith(
      expect.objectContaining({ result: expect.objectContaining({ outcome: 'erro' }) }),
    );
    expect(executeScript).not.toHaveBeenCalled();
    expect(publishRunning()).toBe(false);
  });

  it('fila guardada como em andamento (service worker reiniciado): recusa', async () => {
    const exec = stubChrome({ fila: { ops: [], results: {}, running: true } });
    const reply = vi.fn(async () => undefined);
    expect(await runPublish(CALL, IDLE, reply, true)).toBe(false);
    expect(exec).not.toHaveBeenCalled();
  });

  it('sem currículo do editor, sem consentimento, sem aba ou aba que não responde', async () => {
    const exec = stubChrome();
    expect(await sendPublish(CALL)).toMatchObject({ outcome: 'outro-cv' });
    expect(exec).not.toHaveBeenCalled();
    stubChrome({ consent: false });
    expect((await sendPublish(CALL, '1')).outcome).toBe('consentimento');
    stubChrome({ tabs: [] });
    expect((await sendPublish(CALL, '1')).outcome).toBe('sem-aba');
    stubChrome({ result: undefined });
    expect((await sendPublish(CALL, '1')).outcome).toBe('erro');
    vi.stubGlobal('chrome', {
      scripting: { executeScript: async () => Promise.reject(new Error('fechou')) },
      storage: { local: { get: async () => ({ [CONSENT_KEY]: consentRecord() }) } },
      tabs: { onRemoved: NO_TAB_EVENTS, query: async () => [{ id: 3 }] },
    });
    expect((await sendPublish(CALL, '1')).detail).toContain('Última publicação');
  });

  it('a tela de envio: lida na aba, ou recusada no meio de uma gravação', async () => {
    stubChrome({ result: { lattesId: '1', screen: { declaration: 'D' } } });
    const free = io();
    expect(await answerPublishRequest({ id: 't1', type: 'ler-envio' }, IDLE, free)).toBe(true);
    expect(free.sent).toEqual([
      { id: 't1', lattesId: '1', screen: { declaration: 'D' }, type: 'tela-envio' },
    ]);
    const busy = io(true);
    await answerPublishRequest({ id: 't2', type: 'ler-envio' }, IDLE, busy);
    expect(busy.sent[0]).toMatchObject({ id: 't2', reason: 'ocupado', type: 'tela-envio' });
    stubChrome({ consent: false });
    const noConsent = io();
    await answerPublishRequest({ id: 't3', type: 'ler-envio' }, IDLE, noConsent);
    expect(noConsent.sent[0]).toMatchObject({ reason: 'consentimento' });
    stubChrome({ tabs: [] });
    expect(await readSendScreenReply()).toEqual({ reason: 'sem-aba' });
    vi.stubGlobal('chrome', {
      scripting: { executeScript: async () => Promise.reject(new Error('fechou')) },
      storage: { local: { get: async () => ({ [CONSENT_KEY]: consentRecord() }) } },
      tabs: { onRemoved: NO_TAB_EVENTS, query: async () => [{ id: 3 }] },
    });
    expect(await readSendScreenReply()).toMatchObject({ reason: 'erro' });
  });

  it('o envio pelo despacho, e outras mensagens passam adiante', async () => {
    stubChrome({ result: { outcome: 'publicado' } });
    const sink = io();
    expect(await answerPublishRequest({ ...CALL, type: 'publicar' }, IDLE, sink)).toBe(true);
    expect(sink.sent[0]).toMatchObject({ result: { outcome: 'publicado' }, type: 'publicacao' });
    expect(await answerPublishRequest({ type: 'parar' }, IDLE, sink)).toBe(false);
  });
});

describe('o tempo do envio no painel', () => {
  it('diz onde o tempo foi, passo a passo', () => {
    expect(stepsText(undefined)).toBe('');
    expect(
      stepsText([
        { ms: 400, step: 'menu' },
        { ms: 62_300, step: 'envio' },
        { ms: 3000, step: 'espera' },
        { ms: 500, step: 'conferencia' },
      ]),
    ).toBe(
      ' Tempo no Lattes: 66,2 s (menu 0,4 s, envio 62,3 s, espera entre as conferências 3,0 s, conferência no menu 0,5 s).',
    );
  });

  it('a tarefa de envio espera o envio lento, e o editor espera a tarefa', () => {
    expect(SEND_TIMEOUT_MS).toBeGreaterThan(60_000);
    expect(PUBLISH_PACE.deadlineMs).toBeGreaterThan(SEND_TIMEOUT_MS);
    expect(PUBLISH_REPLY_TIMEOUT_MS).toBeGreaterThan(PUBLISH_PACE.deadlineMs);
  });
});
