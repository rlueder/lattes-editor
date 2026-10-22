// Prévia da tela de envio no `pnpm dev` (?simular-envio): o painel "Enviar ao
// Lattes" recebe uma tela lida de um HTML com o desenho da tela real
// (pkg_publicar.mostrar_cv, lida em 21/10/2026), sem extensão nem Lattes. O
// texto da declaração é de exemplo, não o do CNPq. Com ?publicar, a caixa da
// declaração aparece, como com o envio ligado.

import { readSendScreen } from '../bridge/publish.ts';
import type { SendScreenReading } from '../ui/use-publish.ts';

const PAGE = 'https://wwws.cnpq.br/cvlattesweb/pkg_publicar.mostrar_cv';

const HTML = `<form name="publicar" action="pkg_publicar.enviar"><ul><li>
Texto de exemplo da declaração, no lugar do texto do CNPq: a pessoa declara que os dados do currículo são verdadeiros. <a href="pkg_publicar.mostrar_termo_comp" target="_blank">Termo de Uso e Política de Privacidade da Plataforma Lattes</a>
<input type="checkbox" name=f_chk value="1">Li e estou de acordo com a declaração acima
</li>
<li>Escolha o idioma principal do currículo:
<input type="radio" name="f_idioma" id="idiomaPor" value="1"><label for="idiomaPor">Português</label><input type="radio" name="f_idioma" id="idiomaIng" value="2"><label for="idiomaIng">Inglês</label>
</li>
<li>Autorize a publicação também em inglês do currículo:
<ul><li><input type="checkbox" name=f_chk_en value="1">Autorizo a publicação da versão em inglês do meu currículo</li></ul></li>
<table><tr><td>e-mail para contato<br><INPUT TYPE="text" NAME="f_email_contato" VALUE="pessoa@example.org"></td></tr>
<tr><td>e-mail alternativo<br><INPUT TYPE="text" NAME="f_email_alternativo"></td></tr></table>
</ul></form>`;

/** A leitura simulada, ou undefined fora do `pnpm dev` ou sem ?simular-envio. */
export function simulatedSendScreen(): SendScreenReading | undefined {
  if (!import.meta.env.DEV) return undefined;
  if (!new URLSearchParams(location.search).has('simular-envio')) return undefined;
  return { at: Date.now(), id: 'simulado', screen: readSendScreen(HTML, PAGE) };
}
