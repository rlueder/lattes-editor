// Valores que a página põe por script depois de carregar (form.ts,
// withScriptValues): as privacidades da identificação vinham no padrão do
// HTML, e um envio de 18/10/2026 tornou públicos o nascimento, a identidade, o
// passaporte e a cor (desfeito na hora).

import { afterEach, describe, expect, it } from 'vitest';

import { applyOp } from '../src/bridge/apply.ts';
import {
  type FormControl,
  scriptRadios,
  scriptValues,
  withScriptValues,
} from '../src/bridge/form.ts';
import { planChanges } from '../src/bridge/plan.ts';
import { diffDocuments } from '../src/model/changes.ts';
import { encodeLatin1 } from '../src/model/latin1.ts';
import { parseXml, setAttr, type XElement } from '../src/model/xml.ts';
import {
  faults,
  type LattesSimuladoNoTeste,
  postsOf,
  withLattesSimulado,
} from './helpers/lattes-simulado.ts';

describe('valores postos por script', () => {
  it('só o comando solto $("[name=…]").val("…"), como a página usa', () => {
    const html = `<script>
      $("[name=f_priv_cor]").val("2");
      valorPrivCor ="2";
      $("[name=fnro_id_raca_cor]").val("1");
      $("input[name=f_txt_potencial]").val("");
    </script>`;
    expect([...scriptValues(html)]).toEqual([
      ['f_priv_cor', '2'],
      ['fnro_id_raca_cor', '1'],
    ]);
  });

  it('o rádio que a página marca num if de dois textos, sem ou com chaves', () => {
    const html = `<script>
if ("N" == "S")
    $("input[name=f_sta_inovacao][value=S]").attr("checked", "true");
else {
    $("input[name=f_sta_inovacao][value=N]").attr("checked", "true");
    $("#potencial").hide();
    }
            if ("checked" == "checked") {
              $("input[name=f_pcd_r][value=S]").attr("checked", "true");
            } else {
              $("input[name=f_pcd_r][value=N]").attr("checked", "true");
            }
</script>`;
    expect([...scriptRadios(html)]).toEqual([
      ['f_sta_inovacao', 'N'],
      ['f_pcd_r', 'S'],
    ]);
    const radios: FormControl[] = [
      { name: 'f_sta_inovacao', type: 'radio', value: 'S' },
      { name: 'f_sta_inovacao', type: 'radio', value: 'N' },
    ];
    expect(withScriptValues(html, radios)?.map((c) => c.checked)).toEqual([false, true]);
  });

  it('o select e o oculto ficam com o valor do script; rádio e caixa não', () => {
    const controls: FormControl[] = [
      { name: 'f_priv_cor', selected: ['1'], type: 'select-one', value: '1' },
      { name: 'fnro_id_raca_cor', type: 'hidden', value: '' },
      { checked: true, name: 'f_r', type: 'radio', value: 'N' },
    ];
    const html =
      '$("[name=f_priv_cor]").val("2"); $("[name=fnro_id_raca_cor]").val("1"); $("[name=f_r]").val("S");';
    expect(withScriptValues(html, controls)).toEqual([
      { name: 'f_priv_cor', selected: ['2'], type: 'select-one', value: '2' },
      { name: 'fnro_id_raca_cor', type: 'hidden', value: '1' },
      { checked: true, name: 'f_r', type: 'radio', value: 'N' },
    ]);
  });
});

const XML = `<CURRICULO-VITAE NUMERO-IDENTIFICADOR="1"><DADOS-GERAIS NOME-COMPLETO="Pessoa de Teste" NOME-EM-CITACOES-BIBLIOGRAFICAS="TESTE, P." NACIONALIDADE="B" PAIS-DE-NACIONALIDADE="Brasil" SIGLA-PAIS-NACIONALIDADE="BRA" DATA-NASCIMENTO="03051986" FORMATO-DATA-DE-NASCIMENTO="DDMMAAAA"/></CURRICULO-VITAE>`;

let open: LattesSimuladoNoTeste | undefined;
afterEach(async () => {
  await open?.close();
  open = undefined;
});

describe('identificação com a privacidade posta por script', () => {
  it('o envio leva a privacidade que a página mostra, não o padrão do HTML', async () => {
    open = await withLattesSimulado({
      intercept: faults.rewritePages(/prc_ident/i, (html) =>
        html.replace('</form>', '</form><script>$("[name=f_priv_nascimento]").val("2");</script>'),
      ),
      xml: encodeLatin1(`<?xml version="1.0" encoding="ISO-8859-1"?>\n${XML}`),
    });
    const original = parseXml(XML).root;
    const working = parseXml(XML).root;
    setAttr(
      working.children.find((c): c is XElement => c.kind === 'element')!,
      'DATA-NASCIMENTO',
      '04051986',
    );
    const plan = planChanges(
      diffDocuments(original, working).map((change) => ({ change, itemTitle: '' })),
      working,
      { biographicFull: true, biographicOps: true },
    );
    expect(plan.unsupported).toEqual([]);
    expect(await applyOp(plan.ops[0]!, open.port)).toMatchObject({ status: 'conferido' });
    expect(postsOf(open).at(-1)?.fields.f_priv_nascimento).toBe('2');
  });
});
