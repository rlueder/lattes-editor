import { describe, expect, it } from 'vitest';

import {
  censusForm,
  censusPage,
  isPrivateParam,
  publicPath,
  publicUrl,
  scrubText,
} from '../src/census/census-page.ts';
import { cleanLabel, scanForms, tagAttrs } from '../src/census/html-scan.ts';

// Um formulário com o desenho comum das telas do Lattes (inferido): rótulo numa
// célula, campo na outra, rádios com o texto logo depois, um bloco escondido.
const PAGE = `<html><head><title>Forma&ccedil;&atilde;o</title>
<script>var x = "<input name='nao_conta'>";</script><style>td{}</style></head><body>
<!-- <input name="comentado"> -->
<form name="GN_FORMACAO2" method="POST" action="pkg_formacao.FORM">
<input type="hidden" name="f_ctr" value="I"><input type="hidden" name="f_cod" value="K1234567890">
<input type="hidden" name="f_nivel" value="3"><input type="hidden" name="f_nivel" value="3">
<input type="hidden" name="f_inst_old" value="Universidade X">
<table>
<tr><td>Tipo:</td><td><input type="radio" name="f_tpo_doutorado" value="N" checked> Normal
<input type="radio" name="f_tpo_doutorado" value="S"> Sandu&iacute;che</td></tr>
<tr><td>Institui&ccedil;&atilde;o *</td><td><input type="text" name="f_inst" value="Universidade X" maxlength="75" disabled></td></tr>
<tr><td>Situa&ccedil;&atilde;o:</td><td>
<label><input type="radio" name="F_STATUS" value="N">em andamento</label>
<label><input type="radio" name="F_STATUS" value="S" checked>conclu&iacute;do</label></td></tr>
<tr style="display:none" id="lblDoutorado"><td>Orientador no exterior:</td><td><input name="f_orient_dout" maxlength="60"></td></tr>
<tr><td>Pa&iacute;s</td><td><select name="f_pais"><option value="">Selecione</option>
<option value="BRA" selected>Brasil</option><option value="RFA">Alemanha</option><option>Outro</option></select></td></tr>
<tr><td>Tipo de apresenta&ccedil;&atilde;o</td><td><select name="F_TPO"></select></td></tr>
<tr><td>Resumo</td><td><textarea name="f_ref" maxlength="3950">Texto pessoal da pessoa</textarea></td></tr>
<tr><td>Palavras-chave</td><td><input type="text" id="busca"><input type="button" value="Incluir"></td></tr>
<tr><td><label for="priv">Visibilidade</label></td><td><select id="priv" name="f_tipo_privacidade"><option value="1">P&uacute;blico</option><option value="2">Privado</option></select></td></tr>
<tr><td>Leitura</td><td><input type="checkbox" name="FC_LE" value="on" checked> l&ecirc;</td></tr>
<tr><td>E-mail</td><td><input type="text" name="f_email" value="pessoa@example.org" readonly></td></tr>
</table>
</form>
<input type="text" name="fora_do_form" value="x">
</body></html>`;

describe('censo: leitura dos formulários sem DOM', () => {
  it('lê campos em ordem, com rótulo, opções e o que está escondido', () => {
    const { forms, title } = scanForms(PAGE);
    expect(title).toBe('Formação');
    expect(forms.map((f) => f.name)).toEqual(['GN_FORMACAO2', '']);
    const [form] = forms;
    expect(form!.action).toBe('pkg_formacao.FORM');
    expect(form!.method).toBe('post');
    const visible = form!.fields.filter((f) => f.type !== 'hidden');
    expect(visible.map((f) => [f.name, f.label])).toEqual([
      ['f_tpo_doutorado', 'Tipo'],
      ['f_inst', 'Instituição'],
      ['F_STATUS', 'Situação'],
      ['f_orient_dout', 'Orientador no exterior'],
      ['f_pais', 'País'],
      ['F_TPO', 'Tipo de apresentação'],
      ['f_ref', 'Resumo'],
      ['f_tipo_privacidade', 'Visibilidade'],
      ['FC_LE', 'Leitura'],
      ['f_email', 'E-mail'],
    ]);
    const radio = visible[0]!;
    expect(radio.options!.map(({ chosen, label, value }) => ({ chosen, label, value }))).toEqual([
      { chosen: true, label: 'Normal', value: 'N' },
      { chosen: false, label: 'Sanduíche', value: 'S' },
    ]);
    expect(visible[2]!.options!.map((o) => o.label)).toEqual(['em andamento', 'concluído']);
    expect(visible[1]).toMatchObject({ disabled: true, maxLength: 75, value: 'Universidade X' });
    expect(visible[3]!.inHiddenBlock).toBe(true);
    expect(visible[4]!.options!.map((o) => [o.value, o.label])).toEqual([
      ['', 'Selecione'],
      ['BRA', 'Brasil'],
      ['RFA', 'Alemanha'],
      ['Outro', 'Outro'],
    ]);
    expect(visible[6]!.value).toBe('Texto pessoal da pessoa');
    expect(visible[8]!.options).toMatchObject([{ chosen: true, label: 'lê', value: 'on' }]);
    expect(visible[9]!.readOnly).toBe(true);
    // A caixa de busca sem name e o botão não são campos.
    expect(form!.unnamed).toBe(1);
    expect(forms[1]!.fields.map((f) => f.name)).toEqual(['fora_do_form']);
  });

  it('rádio com o texto antes ("Sim (o) Não (o)"), como nos projetos e patentes', () => {
    const page = censusPage(`<form name="P"><table>
<tr><td>Potencial de inovação</td><td>Sim <input type="radio" name="f_sta_inovacao" value="S"> Não <input type="radio" name="f_sta_inovacao" value="N"></td></tr>
<tr><td>Sexo</td><td>Masculino <input type="radio" name="f_sexo" value="M"></td><td>Feminino <input type="radio" name="f_sexo" value="F"></td></tr>
<tr><td>Classificação</td><td><input type="radio" name="f_c" value="I"> Internacional <input type="radio" name="f_c" value="N"></td></tr>
</table></form>`);
    const [inov, sexo, classif] = page.forms[0]!.fields;
    expect(inov).toMatchObject({
      label: 'Potencial de inovação',
      options: [
        { label: 'Sim', value: 'S' },
        { label: 'Não', value: 'N' },
      ],
    });
    expect(sexo).toMatchObject({
      label: 'Sexo',
      options: [
        { label: 'Masculino', value: 'M' },
        { label: 'Feminino', value: 'F' },
      ],
    });
    // Misturado: fica o texto de depois onde há, e o de antes só onde não é o rótulo do campo.
    expect(classif!.options).toEqual([
      { label: 'Internacional', value: 'I' },
      { label: 'Internacional', value: 'N' },
    ]);
  });

  it('o registro não leva valor do currículo, só nomes, rótulos e opções', () => {
    const page = censusPage(PAGE);
    const text = JSON.stringify(page);
    for (const secret of ['K1234567890', 'Universidade X', 'Texto pessoal', 'pessoa@example.org']) {
      expect(text).not.toContain(secret);
    }
    const form = page.forms[0]!;
    expect(form.hidden).toEqual(['f_ctr', 'f_cod', 'f_nivel', 'f_inst_old']);
    expect(form.identity).toEqual({ f_ctr: 'I', f_nivel: '3' });
    const tpo = form.fields.find((f) => f.name === 'F_TPO')!;
    expect(tpo.scriptFilled).toBe(true);
    expect(tpo.options).toEqual([]);
    const pais = form.fields.find((f) => f.name === 'f_pais')!;
    expect(pais.options).toEqual([
      { label: 'Selecione', value: '' },
      { label: 'Brasil', value: 'BRA' },
      { label: 'Alemanha', value: 'RFA' },
      { label: 'Outro', value: 'Outro' },
    ]);
    expect(form.fields.find((f) => f.name === 'f_inst')).toEqual({
      disabled: true,
      label: 'Instituição',
      maxLength: 75,
      name: 'f_inst',
      type: 'text',
    });
    expect(form.fields.find((f) => f.name === 'f_orient_dout')?.inHiddenBlock).toBe(true);
    expect(form.fields.find((f) => f.name === 'f_email')?.readOnly).toBe(true);
  });

  it('esconde rótulo ou opção com cara de dado pessoal, e os textos pedidos', () => {
    expect(scrubText('CPF: 123.456.789-09')).toBe('[removido]');
    expect(scrubText('Contato pessoa@example.org')).toBe('[removido]');
    expect(scrubText('Telefone 5133334444')).toBe('[removido]');
    expect(scrubText('Ano de conclusão (2024)')).toBe('Ano de conclusão (2024)');
    expect(scrubText('Nome: Maria Exemplo', ['maria exemplo'])).toBe('[removido]');
    expect(scrubText('Nome', ['ab'])).toBe('Nome');
    const page = censusPage(
      `<form name="X"><table><tr><td>CPF 123.456.789-09</td><td><input name="f_x"></td></tr>
<tr><td>Sexo</td><td><select name="f_s"><option value="a@b">Maria Exemplo</option><option value="M">Masculino</option></select></td></tr></table></form>`,
      ['Maria Exemplo'],
    );
    const [x, sexo] = page.forms[0]!.fields;
    expect(x!.label).toBe('[removido]');
    expect(sexo!.options).toEqual([
      { label: '[removido]', value: '[removido]' },
      { label: 'Masculino', value: 'M' },
    ]);
  });

  it('caminho público sem código, números de item nem instituição', () => {
    expect(isPrivateParam('f_cod')).toBe(true);
    expect(isPrivateParam('F_SEQ_HIST')).toBe(true);
    expect(isPrivateParam('f_codinst')).toBe(true);
    expect(isPrivateParam('f_cod_tipo')).toBe(false);
    expect(
      publicPath('PKG_ATIV.vinculos', { f_cod: 'K1', f_codinst: 'D1', f_seq_ativ: '5', x: '' }),
    ).toBe('PKG_ATIV.vinculos?x=');
    expect(publicPath('prc_endereco', { f_cod: 'K1' })).toBe('prc_endereco');
  });

  it('ação do formulário e opção que é endereço perdem o código do currículo', () => {
    const page = censusPage(
      `<form name="A" action="pkg_x.FORM?f_cod=K1234567890&f_tipo=FA"><select name="n">
<option value="pkg_formacao.form?f_cod=K1234567890&f_tipo=FA&f_nivel=4">Doutorado</option></select></form>`,
    );
    expect(page.forms[0]!.action).toBe('pkg_x.FORM?f_tipo=FA');
    expect(page.forms[0]!.fields[0]!.options).toEqual([
      { label: 'Doutorado', value: 'pkg_formacao.form?f_tipo=FA&f_nivel=4' },
    ]);
    expect(publicUrl('a?f_cod=K&flag&x=1')).toBe('a?flag=&x=1');
  });

  it('atributos de tag e rótulos', () => {
    expect(tagAttrs(` name='a' value=b disabled data-x="1" NAME="dup"`)).toEqual({
      'data-x': '1',
      disabled: '',
      name: 'a',
      value: 'b',
    });
    expect(cleanLabel('  * Título da apresentação :  ')).toBe('Título da apresentação');
  });

  it('formulário sem nome usa o id, e o rótulo longo é cortado', () => {
    const long = 'x'.repeat(300);
    const [form] = scanForms(`<form id="busca"><p>${long}</p><input name="q"></form>`).forms;
    expect(form!.name).toBe('busca');
    expect(censusForm(form!).fields[0]!.label).toHaveLength(160);
  });

  it('HTML truncado e tags soltas não travam a leitura', () => {
    const { forms } = scanForms(
      '<form name="A"><div hidden><input name="a"></div></span><input name="b"><select name="c"><option value="1">um',
    );
    expect(forms[0]!.fields.map((f) => [f.name, f.inHiddenBlock])).toEqual([
      ['a', true],
      ['b', false],
      ['c', false],
    ]);
    expect(forms[0]!.fields[2]!.options).toEqual([{ chosen: false, label: 'um', value: '1' }]);
  });
});
