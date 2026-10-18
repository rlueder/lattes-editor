// O que alguns formulários dos itens de teste pedem além dos campos
// (censo-test-items.ts): escolhas feitas pela janela da própria página, uma
// grade de linhas que o check() lê e caixas do navegador que travariam a aba.
// Cada caso saiu de uma rodada no Lattes real (18/10/2026).

import { TEST_MARK, type TestJob } from '../../src/census/test-plan.ts';
import { context } from './censo-test-donors.ts';

type Grid = { getProvider: () => Record<string, unknown>[] };

type PageWindow = Window & {
  dominio?: () => void;
  gridContatos?: Grid;
  gridDetAtiv?: Grid;
  titularPessoaGrid?: Grid;
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

/**
 * A instituição como a janela de busca grava (atribuir da página da
 * agência): o código com D vai sem ele para f_cod_inst2. O código de uma
 * formação sua (13 caracteres, V...) não cabe na coluna da atuação (12).
 */
function institution(code: string, name: string): Record<string, string> {
  const fake = /D/.test(code);
  return {
    f_cod_inst: fake ? '' : code,
    f_cod_inst2: fake ? code.replace('D', '') : '',
    f_inst: name,
  };
}

/** Os campos de cada página que fill() não alcança; devolve o que gravou. */
export function pageValues(w: Window, form: HTMLFormElement, job: TestJob): Record<string, string> {
  const page = w as PageWindow;
  const values: Record<string, string> = {};
  const field = (name: string) => form.elements.namedItem(name) as HTMLInputElement | null;

  const write = (fill: Record<string, string>) => {
    for (const [n, v] of Object.entries(fill)) {
      const el = field(n);
      if (el) el.value = v;
    }
    Object.assign(values, fill);
  };
  // Uma instituição por variante: duas atuações de teste na mesma faziam o
  // Lattes avisar da duplicada num alert() da página de resposta, que trava a aba.
  const agency =
    context.agencies[job.variant % Math.max(1, context.agencies.length)] ?? context.agency;

  // Fora da formação, o código de instituição copiado de uma formação sua
  // não cabe (ORA-12899 na atuação, ORA-06502 no projeto): vale uma
  // instituição da lista de agências do Lattes, com código de 12.
  const code = field('f_cod_inst')?.value ?? '';
  if (agency && code.length > 12 && !/FORMACAO/i.test(form.name)) {
    write(institution(agency.code, agency.name));
    // A orientação liga o curso à instituição (FK_INST_TESE_ORIENTADA): o
    // curso da formação não serve, e o nome dele entra como texto.
    if (field('f_cod_curso')) {
      write({ f_cod_curso: '', f_cod_curso2: '', f_curso: `${TEST_MARK} ${job.tag}` });
    }
  }

  // Atuação: o vínculo sai da janela da página (sele). Escolhido direto, o
  // onchange de f_stavinc volta a escolha para o vazio, e o check() reclama.
  if (field('f_stavinc') && page.sele && page.dominio) {
    if (agency) write(institution(agency.code, agency.name));
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

  // Patente: o depositante e as datas são grades. Você como depositante (a
  // sua linha do autorDP do menu) e a data de depósito (código 1).
  const holders = page.titularPessoaGrid?.getProvider();
  const owner = (window as unknown as { autorDP?: Record<string, string>[] }).autorDP?.find(
    (r) => !r.c,
  );
  if (holders && owner && !holders.some((r) => r.l)) {
    // A forma da linha que a própria página monta (c numérico: vazio dava
    // ORA-06502 na conversão para número).
    const row = { add: true, c: 0, l: owner.l, staValidado: 'N', t: owner.t, tit: 'n' };
    holders.splice(0, holders.length, row);
    values.depositante = owner.l ?? '';
  }
  const dates = page.gridContatos?.getProvider();
  if (dates && !dates.some((r) => r.id)) {
    const day = `${String(10 + (job.variant % 18)).padStart(2, '0')}/03/${2005 + (job.variant % 15)}`;
    dates.unshift({ contato: 'Depósito', endereco: day, id: '1' });
    values.deposito = day;
  }

  // Artigo: o periódico sai da busca, que grava título, ISSN e código.
  const journal = context.journal;
  const title = field('f_titulo_periodico');
  if (title && !title.value && journal) {
    write({
      f_issn: journal.issn,
      f_issn_h: journal.issn.replace('-', ''),
      f_seq_per: journal.seq,
      f_titulo_periodico: journal.title,
      f_titulo_periodico_h: journal.title,
    });
  }

  // Revisor: o periódico ou a agência vêm de uma busca, e o check() só pede
  // o nome. A agência é a primeira da lista; o periódico, o da busca.
  const name = field('f_nme_agencia');
  const nature = field('f_natur')?.value ?? '';
  if (name && !name.value && /^(MB|MA|RV|RA)$/.test(nature)) {
    const fill: Record<string, string> = /A$/.test(nature)
      ? {
          ...(agency ? institution(agency.code, agency.name) : {}),
          f_nme_agencia: agency?.name ?? `${TEST_MARK} ${job.tag}`,
        }
      : {
          f_issn: journal?.issn ?? '',
          f_nme_agencia: journal?.title ?? `${TEST_MARK} ${job.tag}`,
          f_seq_per: journal?.seq ?? '',
        };
    fill.f_nme_agencia_h = fill.f_nme_agencia!;
    delete fill.f_inst;
    write(fill);
  }
  return values;
}
