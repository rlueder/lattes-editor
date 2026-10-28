// A janela das atuações do projeto (PKG_PROJETO.pp_lista_inst com
// f_pgm=INSTVINCULO), de onde a inclusão tira a instituição de execução
// (create-projeto.ts).

import { jsCalls } from './create-shared.ts';
import type { FieldValues } from './plan.ts';

/** Uma instituição da janela pp_lista_inst, com o vínculo quando a linha o traz. */
export interface VinculoChoice {
  code: string;
  name: string;
  /** Os ocultos que preencherOpener copia do vínculo; ausente nas linhas de seleciona(). */
  vinculo?: FieldValues;
}

/**
 * As instituições das atuações que a janela pp_lista_inst oferece. Em
 * 27/10/2026 cada linha chamava preencherOpener(enqua, regime, stavinc,
 * ano_inic, ano_fim, carga, vinc, código, nome), que copia o vínculo para os
 * ocultos (seção 17); em 28/10/2026 as linhas chamavam seleciona(código,
 * nome, sigla), que só grava a instituição e limpa o órgão. Valem as duas.
 */
export function vinculoChoices(html: string): VinculoChoice[] {
  const opener = jsCalls(html, 'preencherOpener')
    .filter((a) => a.length === 9)
    .map(([enqua, regime, stavinc, anoInic, anoFim, carga, vinc, code, name]) => ({
      code: code!,
      name: name!,
      vinculo: {
        F_ANO_FIM: anoFim!,
        F_ANO_INIC: anoInic!,
        f_carga: carga!,
        f_enqua: enqua!,
        f_regime: regime!,
        f_stavinc: stavinc!,
        f_vinc: vinc!,
      },
    }));
  const select = jsCalls(html, 'seleciona')
    .filter((a) => a.length >= 2 && /^[A-Z]\w+$/.test(a[0] ?? ''))
    .map(([code, name]) => ({ code: code!, name: name! }));
  // A linha com o vínculo vale sobre a só da instituição, quando há as duas.
  return [...opener, ...select.filter((c) => !opener.some((o) => o.code === c.code))];
}
