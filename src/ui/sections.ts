// Seções da navegação, espelhando o menu do Lattes. Cada seção agrupa
// contêineres do XML; "Outros dados" recolhe o que nenhuma seção reivindicou,
// para que todo elemento do arquivo apareça em algum lugar.

import { elementLabel, slugify } from '../labels/labels.ts';
import { childElements, firstChild, getAttr, walk, type XElement } from '../model/xml.ts';

export interface SectionGroup {
  /** Elementos a renderizar: contêineres inteiros ou itens soltos (filtros). */
  elements: XElement[];
  /** Id estável, usado como âncora (#grupo) e no ⌘K. */
  id: string;
  label: string;
}

export interface Section {
  groups: SectionGroup[];
  id: string;
  /**
   * O Importar do Lattes lê esta seção (Passo 2). "filtro" marca as visões
   * que só reúnem itens de outras seções (Inovação, Educação): cada item segue
   * a regra da seção de origem.
   */
  importable: boolean | 'filtro';
  label: string;
  /**
   * Seções-filtro: a marca que reúne os itens e todos os itens que podem
   * recebê-la (onde o atributo existe), para marcar daqui mesmo.
   */
  mark?: { attr: string; items: XElement[]; label: string };
}

const PATENT_FAMILY = [
  'PATENTE',
  'CULTIVAR-PROTEGIDA',
  'CULTIVAR-REGISTRADA',
  'DESENHO-INDUSTRIAL',
  'MARCA',
  'TOPOGRAFIA-DE-CIRCUITO-INTEGRADO',
];

function at(root: XElement, path: string): XElement[] {
  let current: XElement[] = [root];
  for (const seg of path.split('/')) current = current.flatMap((el) => childElements(el, seg));
  return current;
}

/** Itens de produção que têm a marca (no item ou nos DADOS-BASICOS-*), qualquer valor. */
function markable(root: XElement, flag: string): XElement[] {
  const items: XElement[] = [];
  walk(root, (el) => {
    if (getAttr(el, 'SEQUENCIA-PRODUCAO') === undefined) return;
    const basics = childElements(el).find((c) => c.name.startsWith('DADOS-BASICOS'));
    if (getAttr(el, flag) !== undefined || (basics && getAttr(basics, flag) !== undefined)) {
      items.push(el);
    }
  });
  return items;
}

/** Itens de produção com um FLAG-* = SIM no próprio item ou nos DADOS-BASICOS-*. */
function flagged(root: XElement, flag: string): XElement[] {
  const items: XElement[] = [];
  walk(root, (el) => {
    if (getAttr(el, 'SEQUENCIA-PRODUCAO') === undefined) return;
    const basics = childElements(el).find((c) => c.name.startsWith('DADOS-BASICOS'));
    if (getAttr(el, flag) === 'SIM' || (basics && getAttr(basics, flag) === 'SIM')) items.push(el);
  });
  return items;
}

function descendants(root: XElement, name: string): XElement[] {
  const found: XElement[] = [];
  walk(root, (el) => {
    if (el.name === name) found.push(el);
  });
  return found;
}

/** Id do grupo = âncora legível na URL: "producoes/artigos-completos-publicados". */
function group(sectionId: string, label: string, elements: XElement[]): SectionGroup {
  return { elements, id: `${sectionId}/${slugify(label)}`, label };
}

/** Um grupo por contêiner encontrado, rotulado pelo nome do contêiner. */
function containers(sectionId: string, root: XElement, paths: string[]): SectionGroup[] {
  return paths.flatMap((path) => {
    const els = at(root, path);
    const name = path.split('/').pop()!;
    return els.length ? [group(sectionId, elementLabel(name), els)] : [];
  });
}

export function buildSections(root: XElement): Section[] {
  const claimed = new Set<XElement>();
  const claim = (groups: SectionGroup[]) => {
    for (const g of groups) for (const el of g.elements) claimed.add(el);
    return groups;
  };

  const dg = firstChild(root, 'DADOS-GERAIS');
  const dadosGerais: SectionGroup[] = [];
  if (dg) {
    // A identificação são os atributos de DADOS-GERAIS; os filhos têm grupo próprio.
    claimed.add(dg);
    dadosGerais.push(group('dados-gerais', 'Identificação', [{ ...dg, children: [] }]));
    dadosGerais.push(
      ...claim(
        containers('dados-gerais', root, [
          'DADOS-GERAIS/RESUMO-CV',
          'DADOS-GERAIS/OUTRAS-INFORMACOES-RELEVANTES',
          'DADOS-GERAIS/ENDERECO',
          'DADOS-GERAIS/IDIOMAS',
          'DADOS-GERAIS/PREMIOS-TITULOS',
          'DADOS-GERAIS/AREAS-DE-ATUACAO',
          'DADOS-GERAIS/LICENCAS',
        ]),
      ),
    );
  }

  const producaoTecnica = firstChild(root, 'PRODUCAO-TECNICA');
  if (producaoTecnica) claimed.add(producaoTecnica);
  const outraProducao = firstChild(root, 'OUTRA-PRODUCAO');
  if (outraProducao) claimed.add(outraProducao);

  const sections: Section[] = [
    { groups: dadosGerais, id: 'dados-gerais', importable: false, label: 'Dados gerais' },
    {
      groups: claim(
        containers('formacao', root, [
          'DADOS-GERAIS/FORMACAO-ACADEMICA-TITULACAO',
          'DADOS-COMPLEMENTARES/FORMACAO-COMPLEMENTAR',
        ]),
      ),
      id: 'formacao',
      importable: false,
      label: 'Formação',
    },
    {
      groups: claim(containers('atuacao', root, ['DADOS-GERAIS/ATUACOES-PROFISSIONAIS'])),
      id: 'atuacao',
      importable: false,
      label: 'Atuação',
    },
    {
      // Os projetos ficam dentro de cada atuação; aqui aparecem juntos, sem reivindicar.
      groups: [group('projetos', 'Projetos', descendants(root, 'PROJETO-DE-PESQUISA'))].filter(
        (g) => g.elements.length,
      ),
      id: 'projetos',
      importable: false,
      label: 'Projetos',
    },
    {
      groups: claim([
        ...containers('producoes', root, [
          'PRODUCAO-BIBLIOGRAFICA/TRABALHOS-EM-EVENTOS',
          'PRODUCAO-BIBLIOGRAFICA/ARTIGOS-PUBLICADOS',
          'PRODUCAO-BIBLIOGRAFICA/ARTIGOS-ACEITOS-PARA-PUBLICACAO',
          'PRODUCAO-BIBLIOGRAFICA/LIVROS-E-CAPITULOS/LIVROS-PUBLICADOS-OU-ORGANIZADOS',
          'PRODUCAO-BIBLIOGRAFICA/LIVROS-E-CAPITULOS/CAPITULOS-DE-LIVROS-PUBLICADOS',
          'PRODUCAO-BIBLIOGRAFICA/TEXTOS-EM-JORNAIS-OU-REVISTAS',
          'PRODUCAO-BIBLIOGRAFICA/DEMAIS-TIPOS-DE-PRODUCAO-BIBLIOGRAFICA',
          'PRODUCAO-TECNICA/SOFTWARE',
          'PRODUCAO-TECNICA/PRODUTO-TECNOLOGICO',
          'PRODUCAO-TECNICA/PROCESSOS-OU-TECNICAS',
          'PRODUCAO-TECNICA/TRABALHO-TECNICO',
          'PRODUCAO-TECNICA/DEMAIS-TIPOS-DE-PRODUCAO-TECNICA',
          'OUTRA-PRODUCAO/PRODUCAO-ARTISTICA-CULTURAL',
        ]),
        ...[at(root, 'OUTRA-PRODUCAO/DEMAIS-TRABALHOS')]
          .filter((els) => els.length)
          .map((els) => group('producoes', 'Demais trabalhos', els)),
      ]),
      id: 'producoes',
      importable: true,
      label: 'Produções',
    },
    {
      groups: claim(
        containers(
          'patentes',
          root,
          PATENT_FAMILY.map((n) => `PRODUCAO-TECNICA/${n}`),
        ),
      ),
      id: 'patentes',
      importable: false,
      label: 'Patentes e Registros',
    },
    {
      groups: [
        group(
          'inovacao',
          'Produção com potencial de inovação',
          flagged(root, 'FLAG-POTENCIAL-INOVACAO'),
        ),
      ].filter((g) => g.elements.length),
      id: 'inovacao',
      importable: 'filtro',
      label: 'Inovação',
      mark: {
        attr: 'FLAG-POTENCIAL-INOVACAO',
        items: markable(root, 'FLAG-POTENCIAL-INOVACAO'),
        label: 'Potencial de inovação',
      },
    },
    {
      groups: [
        group(
          'educacao',
          'Produção de divulgação científica',
          flagged(root, 'FLAG-DIVULGACAO-CIENTIFICA'),
        ),
      ].filter((g) => g.elements.length),
      id: 'educacao',
      importable: 'filtro',
      label: 'Educação e Popularização de C&T',
      mark: {
        attr: 'FLAG-DIVULGACAO-CIENTIFICA',
        items: markable(root, 'FLAG-DIVULGACAO-CIENTIFICA'),
        label: 'Divulgação científica',
      },
    },
    {
      groups: claim(
        containers('eventos', root, ['DADOS-COMPLEMENTARES/PARTICIPACAO-EM-EVENTOS-CONGRESSOS']),
      ),
      id: 'eventos',
      importable: true,
      label: 'Eventos',
    },
    {
      groups: claim(
        containers('orientacoes', root, [
          'DADOS-COMPLEMENTARES/ORIENTACOES-EM-ANDAMENTO',
          'OUTRA-PRODUCAO/ORIENTACOES-CONCLUIDAS',
        ]),
      ),
      id: 'orientacoes',
      importable: true,
      label: 'Orientações',
    },
    {
      groups: claim(
        containers('bancas', root, [
          'DADOS-COMPLEMENTARES/PARTICIPACAO-EM-BANCA-TRABALHOS-CONCLUSAO',
          'DADOS-COMPLEMENTARES/PARTICIPACAO-EM-BANCA-JULGADORA',
        ]),
      ),
      id: 'bancas',
      importable: true,
      label: 'Bancas',
    },
  ];

  // Tudo que sobrou nos níveis de contêiner, inclusive elementos que o schema não conhece.
  const leftovers: XElement[] = [];
  const scan = (parent: XElement | undefined) => {
    if (!parent) return;
    for (const el of childElements(parent)) {
      if (claimed.has(el)) continue;
      if (el === dg || el.name === 'PRODUCAO-BIBLIOGRAFICA' || el.name === 'DADOS-COMPLEMENTARES')
        continue;
      // Contêiner puro cujos filhos já estão em seções (LIVROS-E-CAPITULOS) não sobra.
      const kids = childElements(el);
      if (el.attrs.length === 0 && kids.length > 0 && kids.every((k) => claimed.has(k))) continue;
      leftovers.push(el);
    }
  };
  for (const parent of [
    root,
    dg,
    firstChild(root, 'PRODUCAO-BIBLIOGRAFICA'),
    producaoTecnica,
    outraProducao,
    firstChild(root, 'DADOS-COMPLEMENTARES'),
  ]) {
    scan(parent);
  }
  sections.push({
    groups: leftovers.map((el) => group('outros', elementLabel(el.name), [el])),
    id: 'outros',
    importable: false,
    label: 'Outros dados',
  });

  // Dois grupos de mesmo rótulo numa seção (raro, em "Outros dados") ganham sufixo.
  for (const section of sections) {
    const seen = new Map<string, number>();
    for (const g of section.groups) {
      const n = (seen.get(g.id) ?? 0) + 1;
      seen.set(g.id, n);
      if (n > 1) g.id = `${g.id}-${n}`;
    }
  }
  return sections;
}

/** Quantos itens de lista um grupo tem (para o ⌘K e a navegação). */
export function countItems(g: SectionGroup): number {
  if (g.elements.length !== 1) return g.elements.length;
  const only = g.elements[0]!;
  const kids = childElements(only);
  return kids.length > 0 ? kids.length : 1;
}
