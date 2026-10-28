// Prepara só o exemplo sintético para a auditoria: as listas e os contatos
// precisam de valores reconhecíveis, não do texto genérico do gerador.

import { parseXml, serializeXml, setAttr, walk, type XElement } from '../src/model/xml.ts';
import { lattesSchema } from '../src/schema/lattes.ts';
import { derivedValue, outOfList, typedChoices } from '../src/schema/typed-choices.ts';

/** Os tipos de registro que cada tipo de item aceita (o formulário de cada um). */
export const REGISTRY_KINDS: Record<string, string[]> = {
  'CULTIVAR-PROTEGIDA': ['CULTIVAR_PROTEGIDA_CTV'],
  'CULTIVAR-REGISTRADA': ['CULTIVAR_PROTEGIDA_CTV'],
  'DESENHO-INDUSTRIAL': ['DESENHO_INDUSTRIAL_DI'],
  MARCA: [
    'MARCA_REGISTRADA_DE_PRODUTO_MPD',
    'MARCA_REGISTRADA_DE_SERVICO_MSV',
    'MARCA_REGISTRADA_COLETIVA_MCL',
    'MARCA_REGISTRADA_DE_CERTIFICACAO_MCT',
  ],
  PATENTE: ['PRIVILEGIO_DE_INOVACAO_PI', 'MODELO_DE_UTILIDADE_MU'],
  SOFTWARE: ['PROGRAMA_DE_COMPUTADOR_PC'],
  'TOPOGRAFIA-DE-CIRCUITO-INTEGRADO': ['TOPOGRAFIA_DE_CIRCUITO_INTEGRADO_REGISTRADA_TCI'],
};

const elementsOf = (root: XElement) => {
  const elements: XElement[] = [];
  walk(root, (el) => {
    elements.push(el);
  });
  return elements;
};

/** Os valores de formato fixo que o texto genérico do gerador não respeita. */
/** Os valores de formato fixo, por elemento e atributo, que o texto genérico do gerador não respeita. */
const HOURS = { test: /^\d{0,4}$/, value: '40' };
const FORMATTED: Record<string, { test: RegExp; value: string }> = {
  // A carga horária em horas, nos formulários de formação que a têm.
  ...Object.fromEntries(
    [
      'APERFEICOAMENTO',
      'ESPECIALIZACAO',
      'FORMACAO-COMPLEMENTAR-CURSO-DE-CURTA-DURACAO',
      'FORMACAO-COMPLEMENTAR-DE-EXTENSAO-UNIVERSITARIA',
      'MBA',
      'OUTROS',
    ].map((el) => [`${el}@CARGA-HORARIA`, HOURS]),
  ),
  // CS mostra os três blocos de orientador, que o exemplo preenche.
  'DOUTORADO@TIPO-DOUTORADO': { test: /^(N|S|C|CS)?$/, value: 'CS' },
  'GRADUACAO@TIPO-GRADUACAO': { test: /^(N|S)?$/, value: 'N' },
  'MESTRADO@TIPO-MESTRADO': { test: /^(N|S)?$/, value: 'N' },
};

/** Duas passadas porque a lista de um campo pode depender de outro campo. */
export function withListValues(raw: string): { rewritten: number; xml: string } {
  const doc = parseXml(raw);
  const elements = elementsOf(doc.root);
  const was = new Map(elements.flatMap((el) => el.attrs.map((a) => [a, a.value])));
  for (const item of elements) {
    if (item.name === 'ENDERECO') {
      setAttr(item, 'ELETRONICO', 'I: teste@example.org');
      setAttr(
        item,
        'REDE-SOCIAL',
        'ID Rede Social: 1, Nome Rede Social: GitHub, Endereço: https://example.org/teste',
      );
      setAttr(
        item,
        'OUTRA-FORMA-DE-CONTATO',
        'ID Rede Social: 1, Nome Rede Social: MSN, Endereço: teste@example.org',
      );
    }
    // A natureza do livro tem código por tipo (bibliografica-livros.ts): com
    // Coletânea, que os dois tipos têm, a troca do tipo também se mede.
    if (item.name === 'DADOS-BASICOS-DO-LIVRO') setAttr(item, 'NATUREZA', 'COLETANEA');
    // A licença tem até 180 dias no check() da página (create-licenca.ts).
    if (item.name === 'LICENCA') {
      setAttr(item, 'DATA-INICIO-LICENCA', '01032025');
      setAttr(item, 'DATA-FIM-LICENCA', '30072025');
    }
    const kind = REGISTRY_KINDS[item.name];
    if (!kind) continue;
    for (const reg of elementsOf(item).filter((e) => e.name === 'REGISTRO-OU-PATENTE')) {
      setAttr(reg, 'TIPO-PATENTE', kind[0]!);
    }
  }
  for (let pass = 0; pass < 2; pass++) {
    for (const el of elements) {
      for (const a of el.attrs) {
        const choices = lattesSchema.elements[el.name]?.attributes.find(
          (x) => x.name === a.name,
        )?.enum;
        if (choices?.length && a.value && !choices.includes(a.value)) a.value = choices[0]!;
        if (a.name === 'NACIONALIDADE' && !['B', 'E', ''].includes(a.value)) a.value = 'B';
        if (!choices && a.name.startsWith('FLAG-') && !['', 'SIM', 'NAO'].includes(a.value)) {
          a.value = 'NAO';
        }
        // Sem lista no XSD, mas o formulário só aceita um formato: a carga
        // horária em horas, e o tipo da formação pelo código do rádio (N
        // normal, observado no doutorado em 28/10/2026).
        const format = FORMATTED[`${el.name}@${a.name}`];
        if (format && !format.test.test(a.value)) a.value = format.value;
        if (!outOfList(el, a.name)) continue;
        const value = derivedValue(el.name, a.name) ?? typedChoices(el, a.name)?.[0]?.value;
        if (value !== undefined) a.value = value;
      }
    }
  }
  const rewritten = [...was].filter(([a, v]) => a.value !== v).length;
  return { rewritten, xml: serializeXml(doc) };
}
