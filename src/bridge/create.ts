// Criar itens novos no Lattes pelo conector (LAT-24). Hoje só a atuação
// profissional com um vínculo, pelo formulário de inclusão GN_ATIV
// (PKG_ATIV.INCLUI, f_ctr=I), cujos campos estão em
// docs/lattes_editor_reconnaissance.md, seção 4.1.
//
// DESLIGADO: nenhuma inclusão foi enviada a um Lattes de verdade. O que o
// reconhecimento viu é o formulário vazio e a busca de instituição; a
// resposta do POST de inclusão, o valor de F_COD e F_NIVEL na busca e o
// texto exato de f_vinc para cada tipo de vínculo são inferidos. A chave só
// liga depois de um teste acompanhado, no currículo do dono, com restauração.
//
// Formação acadêmica e projeto estão em create-items.ts (LAT-52), com a mesma
// chave; a patente continua à mão.

import type { Change } from '../model/changes.ts';
import { childElements, getAttr, type XElement } from '../model/xml.ts';
import type { LattesPort, OpResult } from './apply.ts';
import type { FieldSpec, FormSpec } from './contract.ts';
import { CREATE_FIELD_LABELS } from './create-labels.ts';
import {
  encodeLatin1Form,
  type FormControl,
  type Pairs,
  pairValue,
  setPairs,
  successfulPairs,
} from './form.ts';
import { decodeHtmlEntities } from './html-text.ts';
import { findLinks, isLogonPage } from './lattes-html.ts';
import type { FieldValues } from './plan.ts';
import { stavincFromFlag } from './vinculo-flag.ts';

/**
 * Ligada para o teste ao vivo, antes de um teste acompanhado de cada tipo num
 * Lattes real. O plano só a usa com a capacidade `incluir-itens` da extensão
 * (plan.ts). Desligada, o planejamento nunca produz operação de inclusão e o
 * contrato não confere o formulário de inclusão.
 */
export const CREATE_ITEMS_ENABLED = true;

export interface CreateAtuacaoOp {
  /** Nenhum valor anterior: o item não existe no Lattes. */
  expect: FieldValues;
  /** CODIGO-INSTITUICAO do XML (sem a letra que o Lattes põe na frente). */
  institutionCode: string;
  institutionName: string;
  key: string;
  kind: 'criar-atuacao';
  label: string;
  set: FieldValues;
}

/**
 * TIPO-DE-VINCULO do XML → texto do combo dominio() do formulário. Inferido
 * dos rótulos do combo (reconhecimento, seção 4.1); sem envio real.
 */
const VINCULO_TEXT: Record<string, string> = {
  CELETISTA: 'Celetista',
  PROFESSOR_VISITANTE: 'Professor Visitante',
  SERVIDOR_PUBLICO: 'Servidor público',
};

/** O que falta para incluir, em texto para a pessoa; undefined se dá. */
type Planned = CreateAtuacaoOp | { reason: string };

/**
 * Os campos do vínculo no formulário (GN_ATIV na inclusão da atuação,
 * GN_ATIV_VINC na inclusão de um vínculo numa atuação que já existe, LAT-57).
 * O formulário de vínculo novo não tem "Outras informações" em português,
 * só em inglês (censo de 15/10/2026): com `vinculo`, o texto em português vai
 * à mão, e o em inglês e o enquadramento em inglês entram.
 */
export function vinculoFields(
  v: XElement,
  vinculo: boolean,
): { reason: string } | { set: FieldValues } {
  const ano = getAttr(v, 'ANO-INICIO');
  if (!ano) return { reason: 'O vínculo precisa do ano de início' };
  const outro = getAttr(v, 'OUTRO-VINCULO-INFORMADO');
  const tipo = getAttr(v, 'TIPO-DE-VINCULO') ?? '';
  const vinc = outro || VINCULO_TEXT[tipo];
  if (!vinc) return { reason: `Tipo de vínculo ainda não mapeado: ${tipo || 'vazio'}` };
  if (
    getAttr(v, 'ENQUADRAMENTO-FUNCIONAL') &&
    !getAttr(v, 'OUTRO-ENQUADRAMENTO-FUNCIONAL-INFORMADO')
  ) {
    return { reason: 'Enquadramento da lista do Lattes ainda não mapeado; use o texto livre' };
  }
  if (vinculo && getAttr(v, 'OUTRAS-INFORMACOES')?.trim()) {
    return {
      reason: 'O formulário de vínculo novo não tem "Outras informações" em português: vai à mão',
    };
  }
  const anoFim = getAttr(v, 'ANO-FIM') ?? '';
  const set: FieldValues = {
    f_ano_fim: anoFim,
    f_ano_ini: ano,
    f_carga: getAttr(v, 'CARGA-HORARIA-SEMANAL') ?? '',
    f_enqua: getAttr(v, 'OUTRO-ENQUADRAMENTO-FUNCIONAL-INFORMADO') ?? '',
    f_mes_fim: getAttr(v, 'MES-FIM') ?? '',
    f_mes_ini: getAttr(v, 'MES-INICIO') ?? '',
    // Caixa com valor 3: marcada = dedicação exclusiva (como na alteração).
    f_regime: getAttr(v, 'FLAG-DEDICACAO-EXCLUSIVA') === 'SIM' ? '3' : null,
    f_status: anoFim ? 'N' : 'S',
    // Invertido em relação ao XML (vinculo-flag.ts).
    f_stavinc: stavincFromFlag(getAttr(v, 'FLAG-VINCULO-EMPREGATICIO')),
    f_vinc: vinc,
    // check() copia o texto de f_vinc para f_vinculo antes do envio.
    f_vinculo: vinc,
  };
  if (vinculo) {
    set.f_enqua_en = getAttr(v, 'OUTRO-ENQUADRAMENTO-FUNCIONAL-INFORMADO-INGLES') ?? '';
    set.f_outras_inf_en = getAttr(v, 'OUTRAS-INFORMACOES-INGLES') ?? '';
  } else {
    set.f_outras_inf = getAttr(v, 'OUTRAS-INFORMACOES') ?? '';
  }
  return { set };
}

/**
 * Uma atuação nova do editor como operação de inclusão. Só com exatamente
 * um vínculo, com instituição codificada (veio da busca do Lattes) e com os
 * campos que o formulário de inclusão tem.
 */
export function planCreateAtuacao(change: Change, el: XElement, label: string): Planned {
  const institutionCode = getAttr(el, 'CODIGO-INSTITUICAO');
  const institutionName = getAttr(el, 'NOME-INSTITUICAO');
  if (!institutionCode || !institutionName) {
    return { reason: 'Instituição sem código do Lattes: escolha pela busca de instituições' };
  }
  const vinculos = childElements(el, 'VINCULOS');
  if (vinculos.length !== 1) {
    return { reason: 'A inclusão pelo conector cria a atuação com um vínculo só' };
  }
  // A inclusão leva só a atuação e o vínculo: atividades e projetos da atuação
  // nova ficariam para trás sem aviso.
  const hasValue = (e: XElement): boolean =>
    e.attrs.some((a) => a.value.trim() !== '') || childElements(e).some(hasValue);
  if (childElements(el).some((c) => c.name !== 'VINCULOS' && hasValue(c))) {
    return {
      reason: 'A atuação nova tem atividades ou projetos: inclua a atuação primeiro, à mão',
    };
  }
  const fields = vinculoFields(vinculos[0]!, false);
  if ('reason' in fields) return fields;
  const { set } = fields;
  return {
    expect: {},
    institutionCode,
    institutionName,
    key: change.key,
    kind: 'criar-atuacao',
    label,
    set,
  };
}

const text = (maxLength: number): FieldSpec => ({ maxLength, type: 'text' });
const hidden: FieldSpec = { type: 'hidden' };

/**
 * O formulário de inclusão da atuação, como o reconhecimento de 10/10/2026
 * o descreve (seção 4.1). Só entra no contrato com a inclusão ligada.
 * f_tipo_privacidade aparece como "texto, com um select": o tipo exato é
 * inferido e fica de fora da conferência.
 */
export const CREATE_ATUACAO_SPEC: FormSpec & { mode: string; partial: true } = {
  action: 'PKG_ATIV.INCLUI',
  fields: {
    f_ano_fim: text(4),
    f_ano_ini: text(4),
    f_carga: text(3),
    f_cod: hidden,
    f_cod_inst: hidden,
    f_cod_inst2: hidden,
    f_ctr: hidden,
    f_enqua: text(45),
    f_inst: text(75),
    f_inst_old: hidden,
    f_mes_fim: text(2),
    f_mes_ini: text(2),
    f_outras_inf: { maxLength: 3950, type: 'textarea' },
    f_regime: { type: 'checkbox' },
    f_status: { type: 'radio' },
    f_stavinc: { type: 'select-one' },
    f_vinc: text(30),
    f_vinculo: hidden,
  },
  mode: 'I',
  name: 'GN_ATIV',
  // Como as outras inclusões: confere os campos que a operação usa, e um campo
  // a mais no formulário (f_tipo_privacidade) não acusa mudança.
  partial: true,
};

class Stop extends Error {
  status: OpResult['status'];
  constructor(status: OpResult['status'], detail: string) {
    super(detail);
    this.status = status;
  }
}

async function getChecked(port: LattesPort, path: string): Promise<string> {
  const html = await port.get(path);
  if (isLogonPage(html, path)) throw new Stop('sessao', 'A sessão do Lattes caiu; entre de novo');
  return html;
}

/** Resultados da busca de instituição: cada um é javascript:seleciona('código','nome'). */
/**
 * Os resultados da busca de instituição: `seleciona('<código>','<nome>')`. O
 * nome pode ter apóstrofo escapado (D\\'Avila) e entidades do HTML; volta
 * decodificado. Nome que ainda sobra com entidade ou barra fica de fora, para
 * nunca mandar ao Lattes um nome corrompido.
 */
export function institutionResults(html: string): { code: string; name: string }[] {
  const quoted = String.raw`'((?:\\.|[^'\\])*)'`;
  const call = new RegExp(
    String.raw`seleciona\(\s*` + quoted + String.raw`\s*,\s*` + quoted + String.raw`\s*\)`,
    'g',
  );
  return [...html.matchAll(call)]
    .map((m) => ({
      code: m[1]!,
      name: decodeHtmlEntities(m[2]!.replace(/\\(.)/g, '$1')),
    }))
    .filter((r) => !/&\w+;|\\/.test(r.name));
}

/** O código da busca (com a letra na frente) que corresponde ao do XML. */
function sameCode(fromSearch: string, fromXml: string): boolean {
  return fromSearch === fromXml || fromSearch.replace(/^[A-Za-z]/, '') === fromXml;
}

/** As atuações da lista: f_seq_ativ e f_codinst de cada linha. */
function atuacoes(listaHtml: string): { codInst: string; path: string; seqAtiv: string }[] {
  return findLinks(listaHtml, 'pkg_ativ.cargos_vinculos')
    .filter((l) => l.params.f_seq_ativ)
    .map((l) => ({
      codInst: l.params.f_codinst ?? '',
      path: l.path,
      seqAtiv: l.params.f_seq_ativ!,
    }));
}

function readPairs(
  port: LattesPort,
  html: string,
  form: string,
): { controls: FormControl[]; pairs: Pairs } {
  const controls = port.readForm(html, form);
  if (!controls) {
    throw isLogonPage(html)
      ? new Stop('sessao', 'A sessão do Lattes caiu; entre de novo')
      : new Stop('erro', `Formulário ${form} não encontrado`);
  }
  return { controls, pairs: successfulPairs(controls) };
}

/** Campos da inclusão que também existem no formulário de alteração do vínculo. */
const READ_BACK = ['f_ano_fim', 'f_ano_ini', 'f_carga', 'f_enqua', 'f_mes_fim', 'f_mes_ini'];

/**
 * Inclui a atuação e confere: antes, a lista não pode já ter essa
 * instituição (seria duplicata); depois, precisa ter exatamente uma atuação
 * nova dela, e o vínculo lido de volta precisa trazer o que foi enviado.
 * O número que o Lattes deu (f_seq_ativ) volta em `assigned`.
 */
export async function applyCreateAtuacao(
  op: CreateAtuacaoOp,
  port: LattesPort,
): Promise<OpResult & { assigned?: Record<string, string> }> {
  const result = (status: OpResult['status'], detail: string) => ({ detail, key: op.key, status });
  try {
    const menu = await port.menuHtml();
    const lista = findLinks(menu, 'pkg_ativ.lista')[0];
    if (!lista) throw new Stop('erro', 'Atuação profissional não encontrada no menu do Lattes');
    const before = await getChecked(port, lista.path);
    if (atuacoes(before).some((a) => sameCode(a.codInst, op.institutionCode))) {
      return result(
        'divergente',
        'O Lattes já tem uma atuação nessa instituição; inclua o vínculo nela, à mão',
      );
    }
    const inclui = findLinks(before, 'pkg_ativ.inclui')[0];
    if (!inclui) throw new Stop('erro', 'Inclusão de atuação não encontrada na lista do Lattes');
    const formHtml = await getChecked(port, inclui.path);
    const form = readPairs(port, formHtml, CREATE_ATUACAO_SPEC.name);
    if (pairValue(form.pairs, 'f_ctr') !== 'I') {
      return result('erro', 'O formulário não está em modo de inclusão');
    }

    // Busca de instituição, como o seletor do formulário faz (seção 4.3). Os
    // valores de F_COD e F_NIVEL nesta tela são inferidos.
    const search = encodeLatin1Form([
      ['f_nome', op.institutionName],
      ['F_CTR', 'C'],
      ['F_COD', pairValue(form.pairs, 'f_cod') ?? ''],
      ['F_NIVEL', ''],
      ['F_STA_OUTRA', 'N'],
    ]);
    const found = institutionResults(await port.post('PRC_INST_FORM', search)).filter((r) =>
      sameCode(r.code, op.institutionCode),
    );
    if (found.length !== 1) {
      return result(
        'erro',
        `Instituição não encontrada na busca do Lattes (${found.length} resultados com o código)`,
      );
    }
    const { code, name } = found[0]!;
    // A busca preenche f_cod_inst quando o código começa com V, f_cod_inst2 nos outros casos.
    const institution: FieldValues = code.startsWith('V')
      ? { f_cod_inst: code, f_inst: name, f_inst_old: name }
      : { f_cod_inst2: code, f_inst: name, f_inst_old: name };

    const set = { ...op.set, ...institution };
    for (const [field, value] of Object.entries(set)) {
      const limit = form.controls.find((c) => c.name === field)?.maxLength;
      if (value && limit && limit > 0 && value.length > limit) {
        return result('erro', `${field} passa do limite do Lattes (${limit} caracteres)`);
      }
    }
    const response = await port.post(
      CREATE_ATUACAO_SPEC.action,
      encodeLatin1Form(setPairs(form.pairs, set)),
    );
    if (isLogonPage(response)) return result('sessao', 'A sessão do Lattes caiu; entre de novo');
    // Depois do POST aceito, a atuação pode existir no Lattes mesmo quando a
    // conferência não acha uma só: o aviso diz isso, para ninguém mandar de
    // novo e criar duplicata.
    const maybe = (why: string) =>
      result(
        'divergente',
        `O Lattes aceitou o envio, mas ${why}. A atuação pode ter sido criada: confira no Lattes antes de mandar de novo.`,
      );
    try {
      const after = atuacoes(await getChecked(port, lista.path));
      const known = new Set(atuacoes(before).map((a) => a.seqAtiv));
      const created = after.filter(
        (a) => !known.has(a.seqAtiv) && sameCode(a.codInst, op.institutionCode),
      );
      if (created.length !== 1) {
        return maybe(`a lista mostra ${created.length} atuações novas (${created.length} achadas)`);
      }
      const gridHtml = await getChecked(port, created[0]!.path);
      const vinculo = findLinks(gridHtml, 'pkg_ativ.vinculos').find((l) => l.params.f_seq_hist);
      // Daqui em diante a atuação existe no Lattes: todo resultado leva a
      // sequência que ela recebeu, para o registro do enviado saber dela.
      const seqAtiv = created[0]!.seqAtiv;
      const assigned = { 'SEQUENCIA-ATIVIDADE': seqAtiv };
      if (!vinculo) {
        return {
          ...result('divergente', `Criada no Lattes (atuação ${seqAtiv}), mas sem o vínculo`),
          assigned,
        };
      }
      const saved = readPairs(port, await getChecked(port, vinculo.path), 'GN_ATIV_VINC').pairs;
      const wrong = READ_BACK.filter((f) => (pairValue(saved, f) ?? '') !== (set[f] ?? ''));
      if (wrong.length > 0) {
        return {
          ...result(
            'divergente',
            `Criada no Lattes (atuação ${seqAtiv}), mas o Lattes guardou outro valor em: ${wrong.map((f) => CREATE_FIELD_LABELS[f] ?? f).join(', ')}. Confira no Lattes`,
          ),
          assigned,
        };
      }
      return {
        ...result('conferido', `Criado e conferido no Lattes (atuação ${seqAtiv})`),
        assigned,
      };
    } catch (err) {
      const why = err instanceof Error ? err.message : 'falha inesperada';
      return maybe(`a conferência falhou (${why})`);
    }
  } catch (err) {
    if (err instanceof Stop) return result(err.status, err.message);
    return result('erro', err instanceof Error ? err.message : 'Falha inesperada');
  }
}
