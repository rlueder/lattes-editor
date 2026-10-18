// O que alguns formulários dos itens de teste pedem além dos campos
// (censo-test-items.ts): escolhas feitas pela janela da própria página, uma
// grade de linhas que o check() lê e caixas do navegador que travariam a aba.
// Cada caso saiu de uma rodada no Lattes real (18/10/2026).

import { TEST_MARK, type TestJob } from '../../src/census/test-plan.ts';
import { context } from './censo-test-donors.ts';

type PageWindow = Window & {
  dominio?: () => void;
  gridDetAtiv?: { getProvider: () => Record<string, unknown>[] };
  sele?: (txt: string) => void;
  seleDominio?: boolean;
};

/** Os vínculos da janela "Vínculo" da atuação, sem o "Outro". */
const BONDS = ['Servidor público', 'Celetista', 'Professor Visitante', 'Bolsista'];

/**
 * alert() e prompt() do quadro abrem a caixa do navegador, que trava a aba
 * inteira até alguém clicar (o projeto avisa quem vai validar). O confirm()
 * segue em submit(), que responde sim.
 */
export function silenceDialogs(w: Window): void {
  w.alert = () => undefined;
  w.prompt = () => null;
}

/** Os campos de cada página que fill() não alcança; devolve o que gravou. */
export function pageValues(w: Window, form: HTMLFormElement, job: TestJob): Record<string, string> {
  const page = w as PageWindow;
  const values: Record<string, string> = {};
  const field = (name: string) => form.elements.namedItem(name) as HTMLInputElement | null;

  // Atuação: o vínculo sai da janela da página (sele). Escolhido direto, o
  // onchange de f_stavinc volta a escolha para o vazio, e o check() reclama.
  if (field('f_stavinc') && page.sele && page.dominio) {
    page.seleDominio = true;
    const bond = BONDS[job.variant % BONDS.length]!;
    page.sele(bond);
    values.f_vinc = bond;
    values.f_stavinc = field('f_stavinc')!.value;
  }

  // Atividade: a descrição é uma linha da grade "Cargo ou função", que o
  // check() lê do provedor. Sem generate(): ele abre a edição de uma linha
  // nova, e o texto de instrução dela entraria como outra atividade.
  const grid = page.gridDetAtiv?.getProvider();
  if (grid) {
    const line = `${TEST_MARK} ${job.tag}`;
    grid.splice(0, grid.length, { c: 0, l: line }, {});
    values.cargo = line;
  }

  // Revisor: o periódico ou a agência vêm de uma busca, e o check() só pede
  // o nome. A agência é a primeira da lista; o periódico, o de um artigo seu.
  const name = field('f_nme_agencia');
  const nature = field('f_natur')?.value ?? '';
  if (name && !name.value && /^(MB|MA|RV|RA)$/.test(nature)) {
    const journal = Object.values(context.donors).find((d) => d.f_seq_per);
    const fill: Record<string, string> = /A$/.test(nature)
      ? { f_nme_agencia: context.agency?.name ?? `${TEST_MARK} ${job.tag}` }
      : {
          f_issn: journal?.f_issn ?? '',
          f_nme_agencia:
            journal?.f_titulo_periodico ?? journal?.f_nme_agencia ?? `${TEST_MARK} ${job.tag}`,
          f_seq_per: journal?.f_seq_per ?? '',
        };
    fill.f_nme_agencia_h = fill.f_nme_agencia!;
    for (const [n, v] of Object.entries(fill)) {
      const el = field(n);
      if (el) el.value = v;
    }
    Object.assign(values, fill);
  }
  return values;
}
