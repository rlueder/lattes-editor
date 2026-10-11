// Formulários desenhados para os tipos que um mestrando mais usa (guia, marco 2).
// Cada um lista os campos principais, na ordem em que fazem sentido para quem
// preenche; o resto dos atributos fica em "Mais campos", na visão genérica.
// Rótulos vêm do nome XML; trocá-los pela redação dos formulários do Lattes é
// trabalho pendente (guia, seção 6).

export interface FieldSpec {
  attr: string;
  multiline?: boolean;
  /** Obrigatório para o editor gerar o arquivo (além do que o XSD exige). */
  required?: boolean;
  wide?: boolean;
}

export interface Fieldset {
  fields: FieldSpec[];
  legend: string;
  /** Prefixo da parte do item: DADOS-BASICOS ou DETALHAMENTO. */
  part: 'DADOS-BASICOS' | 'DETALHAMENTO';
}

export interface FormSpec {
  fieldsets: Fieldset[];
  itemName: string;
  /** Título do formulário, no singular. */
  title: string;
}

const f = (attr: string, extra: Omit<FieldSpec, 'attr'> = {}): FieldSpec => ({ attr, ...extra });
const title = (attr: string) => f(attr, { required: true, wide: true });
const year = (attr: string) => f(attr, { required: true });

export const FORM_SPECS: FormSpec[] = [
  {
    fieldsets: [
      {
        fields: [
          title('TITULO-DO-TRABALHO'),
          year('ANO-DO-TRABALHO'),
          f('NATUREZA'),
          f('IDIOMA'),
          f('PAIS-DO-EVENTO'),
          f('MEIO-DE-DIVULGACAO'),
          f('DOI'),
          f('HOME-PAGE-DO-TRABALHO'),
        ],
        legend: 'Trabalho',
        part: 'DADOS-BASICOS',
      },
      {
        fields: [
          f('NOME-DO-EVENTO', { required: true, wide: true }),
          f('CLASSIFICACAO-DO-EVENTO'),
          f('CIDADE-DO-EVENTO'),
          f('ANO-DE-REALIZACAO'),
          f('TITULO-DOS-ANAIS-OU-PROCEEDINGS', { wide: true }),
          f('PAGINA-INICIAL'),
          f('PAGINA-FINAL'),
          f('VOLUME'),
          f('ISBN'),
          f('NOME-DA-EDITORA'),
          f('CIDADE-DA-EDITORA'),
        ],
        legend: 'Evento e anais',
        part: 'DETALHAMENTO',
      },
    ],
    itemName: 'TRABALHO-EM-EVENTOS',
    title: 'Trabalho publicado em anais de evento',
  },
  {
    fieldsets: [
      {
        fields: [
          title('TITULO-DO-ARTIGO'),
          year('ANO-DO-ARTIGO'),
          f('NATUREZA'),
          f('IDIOMA'),
          f('PAIS-DE-PUBLICACAO'),
          f('MEIO-DE-DIVULGACAO'),
          f('DOI'),
          f('HOME-PAGE-DO-TRABALHO'),
        ],
        legend: 'Artigo',
        part: 'DADOS-BASICOS',
      },
      {
        fields: [
          f('TITULO-DO-PERIODICO-OU-REVISTA', { required: true, wide: true }),
          f('ISSN'),
          f('VOLUME'),
          f('FASCICULO'),
          f('SERIE'),
          f('PAGINA-INICIAL'),
          f('PAGINA-FINAL'),
          f('LOCAL-DE-PUBLICACAO'),
        ],
        legend: 'Periódico',
        part: 'DETALHAMENTO',
      },
    ],
    itemName: 'ARTIGO-PUBLICADO',
    title: 'Artigo completo publicado',
  },
  {
    fieldsets: [
      {
        fields: [title('TITULO'), year('ANO'), f('NATUREZA'), f('IDIOMA'), f('PAIS'), f('DOI')],
        legend: 'Apresentação',
        part: 'DADOS-BASICOS',
      },
      {
        fields: [
          f('NOME-DO-EVENTO', { required: true, wide: true }),
          f('INSTITUICAO-PROMOTORA', { wide: true }),
          f('LOCAL-DA-APRESENTACAO'),
          f('CIDADE-DA-APRESENTACAO'),
        ],
        legend: 'Evento',
        part: 'DETALHAMENTO',
      },
    ],
    itemName: 'APRESENTACAO-DE-TRABALHO',
    title: 'Apresentação de trabalho',
  },
  {
    fieldsets: [
      {
        fields: [
          f('TITULO', { wide: true }),
          year('ANO'),
          f('NATUREZA'),
          f('FORMA-PARTICIPACAO'),
          f('TIPO-PARTICIPACAO'),
          f('PAIS'),
          f('IDIOMA'),
          f('MEIO-DE-DIVULGACAO'),
        ],
        legend: 'Participação',
        part: 'DADOS-BASICOS',
      },
      {
        fields: [
          f('NOME-DO-EVENTO', { required: true, wide: true }),
          f('LOCAL-DO-EVENTO'),
          f('CIDADE-DO-EVENTO'),
        ],
        legend: 'Evento',
        part: 'DETALHAMENTO',
      },
    ],
    itemName: 'PARTICIPACAO-EM-CONGRESSO',
    title: 'Participação em congresso',
  },
  {
    fieldsets: [
      {
        fields: [
          title('TITULO-DO-LIVRO'),
          year('ANO'),
          f('TIPO'),
          f('NATUREZA'),
          f('IDIOMA'),
          f('PAIS-DE-PUBLICACAO'),
          f('MEIO-DE-DIVULGACAO'),
          f('DOI'),
        ],
        legend: 'Livro',
        part: 'DADOS-BASICOS',
      },
      {
        fields: [
          f('NOME-DA-EDITORA', { wide: true }),
          f('CIDADE-DA-EDITORA'),
          f('ISBN'),
          f('NUMERO-DE-PAGINAS'),
          f('NUMERO-DE-VOLUMES'),
          f('NUMERO-DA-EDICAO-REVISAO'),
          f('NUMERO-DA-SERIE'),
        ],
        legend: 'Edição',
        part: 'DETALHAMENTO',
      },
    ],
    itemName: 'LIVRO-PUBLICADO-OU-ORGANIZADO',
    title: 'Livro publicado ou organizado',
  },
  {
    fieldsets: [
      {
        fields: [
          title('TITULO-DO-CAPITULO-DO-LIVRO'),
          year('ANO'),
          f('TIPO'),
          f('IDIOMA'),
          f('PAIS-DE-PUBLICACAO'),
          f('MEIO-DE-DIVULGACAO'),
          f('DOI'),
        ],
        legend: 'Capítulo',
        part: 'DADOS-BASICOS',
      },
      {
        fields: [
          f('TITULO-DO-LIVRO', { required: true, wide: true }),
          f('ORGANIZADORES', { wide: true }),
          f('PAGINA-INICIAL'),
          f('PAGINA-FINAL'),
          f('NOME-DA-EDITORA'),
          f('CIDADE-DA-EDITORA'),
          f('ISBN'),
          f('NUMERO-DA-EDICAO-REVISAO'),
        ],
        legend: 'Livro',
        part: 'DETALHAMENTO',
      },
    ],
    itemName: 'CAPITULO-DE-LIVRO-PUBLICADO',
    title: 'Capítulo de livro publicado',
  },
];

export function formSpec(itemName: string): FormSpec | undefined {
  return FORM_SPECS.find((s) => s.itemName === itemName);
}

/** Campos de formulário marcados obrigatórios que estão vazios no item. */
export function missingRequired(
  spec: FormSpec,
  partOf: (
    prefix: Fieldset['part'],
  ) => { attrs: { name: string; value: string }[]; name: string } | undefined,
): { attr: string; element: string }[] {
  const missing: { attr: string; element: string }[] = [];
  for (const set of spec.fieldsets) {
    const part = partOf(set.part);
    if (!part) continue;
    for (const field of set.fields) {
      if (!field.required) continue;
      const value = part.attrs.find((a) => a.name === field.attr)?.value ?? '';
      if (!value.trim()) missing.push({ attr: field.attr, element: part.name });
    }
  }
  return missing;
}
