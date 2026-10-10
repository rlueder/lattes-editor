// Forma do modelo gerado em lattes.json (ver scripts/gen-schema.ts).

export interface ChildSpec {
  max: number | 'unbounded';
  min: number;
  name: string;
}

export interface AttributeSpec {
  default?: string;
  enum?: string[];
  name: string;
  /** Atributo que vem do schema/patch.json, não do XSD publicado. */
  patched?: boolean;
  required: boolean;
}

export interface ElementSpec {
  attributes: AttributeSpec[];
  /** Filhos em sequência: a ordem aqui é a ordem obrigatória no arquivo. */
  children: ChildSpec[];
  /** Aceita texto (DISCIPLINA, INTEGRANTES-DO-PROJETO, TREINAMENTO). */
  mixed: boolean;
}

export interface LattesSchema {
  elements: Record<string, ElementSpec>;
  root: string;
  source: string;
}
