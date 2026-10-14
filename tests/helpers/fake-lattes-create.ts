// Um Lattes falso para as inclusões de formação e de projeto: páginas em HTML
// montadas como as descritas em docs/lattes_internals.md (seções 17 e 18), com
// estado. O POST de inclusão grava uma linha nova na lista, com o que foi
// enviado; a releitura devolve o gravado.

import type { LattesPort } from '../../src/bridge/apply.ts';
import type { FormControl } from '../../src/bridge/form.ts';

export const CV = 'K000000000';

/** Corpo application/x-www-form-urlencoded em Latin-1, de volta a pares. */
export function decodeBody(body: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const kv of body.split('&')) {
    const [k, v = ''] = kv
      .split('=')
      .map((s) =>
        s
          .replace(/\+/g, ' ')
          .replace(/%([0-9A-F]{2})/gi, (_, h: string) => String.fromCharCode(parseInt(h, 16))),
      );
    if (k) out[k] = v;
  }
  return out;
}

const control = (name: string, value = '', type = 'text', maxLength?: number): FormControl => ({
  maxLength,
  name,
  type,
  value,
});

/** O formulário como o readForm devolveria: cada campo com o tipo da tabela. */
function controlsFrom(values: Record<string, string>, types: Record<string, string>) {
  return Object.entries(types).map(([name, type]) => {
    const [t, max] = type.split(':');
    const value = values[name] ?? '';
    if (t === 'radio') return { ...control(name, value, 'radio'), checked: value !== '' };
    if (t === 'select-one')
      return { ...control(name, '', 'select-one'), selected: value ? [value] : [] };
    return control(name, value, t, max ? Number(max) : undefined);
  });
}

/** Campos do GN_FORMACAO2 no mestrado; `hide` torna alguns ocultos (outros níveis). */
export const FORMACAO_TYPES: Record<string, string> = {
  F_BOLSA: 'radio',
  F_STATUS: 'radio',
  f_agencia: 'hidden',
  f_ano_fim: 'text:4',
  f_ano_ini: 'text:4',
  f_ano_obten: 'text:4',
  f_carga: 'hidden',
  f_cod: 'hidden',
  f_cod_curso: 'hidden',
  f_cod_curso2: 'hidden',
  f_cod_inst: 'hidden',
  f_cod_inst2: 'hidden',
  f_coorient: 'text:60',
  f_ctr: 'hidden',
  f_curso: 'text:75',
  f_curso_old: 'hidden',
  f_inst: 'text:75',
  f_inst_old: 'hidden',
  f_mes_obten: 'text:2',
  f_nivel: 'hidden',
  f_nme_agencia: 'text:75',
  f_orient: 'text:60',
  f_seq: 'hidden',
  f_tipo: 'hidden',
  f_tipo_privacidade: 'select-one',
  f_titulo: 'text:254',
  f_tpo_doutorado: 'radio',
};

export interface FakeOpts {
  /** Quantas linhas o POST cria (0 simula um envio recusado em silêncio). */
  created?: number;
  /** Valor de f_ctr no formulário de inclusão. */
  ctr?: string;
  /** Campos ocultos neste nível ou nesta natureza. */
  hide?: string[];
  /** A resposta do POST é a tela de login. */
  logonOnPost?: boolean;
  /** HTML da busca de instituição, curso, agência ou atuações, no lugar do padrão. */
  pages?: Partial<Record<'agencia' | 'curso' | 'inst' | 'vinculos', string>>;
  /** Linhas que a lista já tem: valores do formulário de cada uma. */
  rows?: Record<string, string>[];
  /** Depois do POST, a lista cai na tela de login. */
  sessionAfterPost?: boolean;
  /** Muda um campo na gravação, para a releitura acusar. */
  tamper?: Record<string, string>;
}

const LOGON = '<SCRIPT>location="pkg_sec.logon?f_cod=ini"</SCRIPT>';

/** Formação acadêmica: menu, lista, formulário por nível, buscas e o POST. */
export function fakeFormacao(opts: FakeOpts = {}) {
  const rows: Record<string, string>[] = (opts.rows ?? []).map((r, i) => ({
    ...r,
    f_seq: String(i + 1),
  }));
  const posts: { body: Record<string, string>; path: string }[] = [];
  const gets: string[] = [];
  let posted = false;
  const types = { ...FORMACAO_TYPES };
  for (const f of opts.hide ?? []) types[f] = 'hidden';
  const lista = () =>
    `${rows
      .map(
        (r) =>
          `<tr onclick="self.parent.modalCV2.setarUrl('pkg_formacao.form?f_cod=${CV}&amp;f_tipo=FA&amp;f_seq=${r.f_seq}',true)"><td>x</td></tr>`,
      )
      .join('')}<a onclick="selecionarNivel()">Incluir novo item</a>`;
  const port: LattesPort = {
    async get(path: string) {
      gets.push(path);
      if (path.startsWith('pkg_formacao.lista')) {
        return posted && opts.sessionAfterPost ? LOGON : lista();
      }
      if (path.startsWith('pkg_formacao.form')) {
        const seq = /f_seq=(\d+)/.exec(path)?.[1];
        if (seq) return `FORM:GN_FORMACAO2:seq:${seq}`;
        return `FORM:GN_FORMACAO2:novo:${/f_nivel=(\w)/.exec(path)?.[1] ?? ''}`;
      }
      if (path.startsWith('PRC_INST_FORM')) {
        return (
          opts.pages?.inst ??
          `<a href="javascript:seleciona('D001000000998','UNIVERSIDADE DE EXEMPLO')">UNIVERSIDADE DE EXEMPLO (RS)</a><br>
           <a href="javascript:seleciona('V007900000004','UNIVERSIDADE ESTADUAL DE CAMPINAS')">UNICAMP</a><br>
           Foram encontrados 2 registros.`
        );
      }
      if (path.startsWith('prc_curso_form')) {
        return (
          opts.pages?.curso ??
          `<form name="GN_CURSO_FORM"><select name="f_curso">
             <option value="">Selecione</option>
             <option value="D12345678 ">Genética e Biologia Molecular(42001013004P0)</option>
             <option value="V87654321 ">Administra&ccedil;&atilde;o(33003025005P3)</option>
           </select></form>`
        );
      }
      if (path.startsWith('prc_agencia')) {
        return (
          opts.pages?.agencia ??
          `<a href="javascript:atribuir('045000000000','Conselho Nacional de Desenvolvimento Científico e Tecnológico')">CNPq</a>
           <a href="javascript:atribuir('045000000001','Coordenação de Aperfeiçoamento de Pessoal de Nível Superior')">CAPES</a>`
        );
      }
      return '';
    },
    menuHtml: () =>
      `<a href="pkg_formacao.lista?f_cod=${CV}&amp;f_tipo=FA">Formação</a>
       <a href="pkg_formacao_compl.lista?f_cod=${CV}&amp;f_tipo=FC">Complementar</a>`,
    async post(path: string, body: string) {
      const values = decodeBody(body);
      posts.push({ body: values, path });
      posted = true;
      if (opts.logonOnPost) return LOGON;
      for (let i = 0; i < (opts.created ?? 1); i++) {
        rows.push({ ...values, ...opts.tamper, f_ctr: 'U', f_seq: String(rows.length + 1) });
      }
      return '<script>parent.modalCV1.recarregar()</script>';
    },
    readForm(html: string, form: string) {
      const m = /^FORM:(\w+):(seq|novo):(\w*)$/.exec(html);
      if (!m || m[1] !== form) return undefined;
      if (m[2] === 'seq') {
        const row = rows.find((r) => r.f_seq === m[3]);
        return row ? controlsFrom(row, types) : undefined;
      }
      return controlsFrom(
        { f_cod: CV, f_ctr: opts.ctr ?? 'I', f_nivel: m[3]!, f_tipo: 'FA' },
        types,
      );
    },
  };
  return { gets, port, posts, rows };
}

/** Campos do GN_PROJETO (tabela da seção 17). */
export const PROJETO_TYPES: Record<string, string> = {
  F_ANO_FIM: 'text:4',
  F_ANO_INIC: 'text:4',
  F_NRO_DOUTORADO: 'text:2',
  F_NRO_ESPECIALIZACAO: 'text:2',
  F_NRO_GRADUACAO: 'text:2',
  F_NRO_MESTRADO_ACAD: 'text:2',
  F_NRO_MESTRADO_PROF: 'text:2',
  F_NRO_PRIMEIRO_GRAU: 'hidden',
  F_NRO_SEGUNDO_GRAU: 'hidden',
  F_TPO_NATUREZA: 'select-one',
  F_TPO_SITUACAO: 'select-one',
  f_autores_l: 'hidden',
  f_carga: 'hidden',
  f_cnpj_empresa: 'text:18',
  f_cod: 'hidden',
  f_cod_inst: 'hidden',
  f_cod_inst2: 'hidden',
  f_cod_tipo: 'hidden',
  f_codinst: 'hidden',
  f_ctr: 'hidden',
  f_enqua: 'hidden',
  f_inst: 'text:75',
  f_inst_l: 'hidden',
  f_inst_old: 'hidden',
  f_instituicoes: 'hidden',
  f_instold: 'hidden',
  f_nro_tec_nivel_medio: 'hidden',
  f_orientacoes_d: 'hidden',
  f_orientacoes_l: 'hidden',
  f_producoes_d: 'hidden',
  f_producoes_l: 'hidden',
  f_ref: 'textarea:3900',
  f_ref_en: 'textarea:3900',
  f_regime: 'hidden',
  f_seq_ativ: 'hidden',
  f_seq_funcao: 'hidden',
  f_seq_proj: 'hidden',
  f_sta_inovacao: 'radio',
  f_stavinc: 'hidden',
  f_tematica: 'hidden',
  f_tipo_privacidade: 'select-one',
  f_titulo: 'text:255',
  f_titulo_en: 'text:255',
  f_tpo_acao_inov: 'hidden',
  f_tpo_cooperacao: 'hidden',
  f_tpo_pesq_emp: 'radio',
  f_txt_potencial: 'text:400',
  f_vinc: 'hidden',
};

export const INCLUSION = `PKG_PROJETO.form?f_tpo_cooperacao=X&amp;f_tpo_acao_inov=X&amp;f_tematica=X&amp;F_sta_inovacao=&amp;f_cod_tipo=P&amp;f_cod=${CV}`;

/** Projetos de pesquisa: menu, lista com o link de inclusão, janela das atuações e o POST. */
export function fakeProjeto(opts: FakeOpts & { noInclusion?: boolean } = {}) {
  const rows: Record<string, string>[] = (opts.rows ?? []).map((r, i) => ({
    ...r,
    f_seq_proj: String(i + 1),
  }));
  const posts: { body: Record<string, string>; path: string }[] = [];
  let posted = false;
  const types = { ...PROJETO_TYPES };
  for (const f of opts.hide ?? []) types[f] = 'hidden';
  const lista = () =>
    rows
      .map(
        (r) =>
          `<tr onclick="self.parent.modalCV2.setarUrl('PKG_PROJETO.form?f_cod=${CV}&amp;f_cod_tipo=P&amp;f_seq_proj=${r.f_seq_proj}',true)"><td>x</td></tr>`,
      )
      .join('') +
    (opts.noInclusion
      ? ''
      : `<a onclick="self.parent.modalCV2.setarUrl('${INCLUSION}',true)">Incluir novo item</a>`);
  const port: LattesPort = {
    async get(path: string) {
      if (path.startsWith('pkg_projeto.lista'))
        return posted && opts.sessionAfterPost ? LOGON : lista();
      if (path.startsWith('PKG_PROJETO.form')) {
        const seq = /f_seq_proj=(\d+)/.exec(path)?.[1];
        return seq ? `FORM:GN_PROJETO:seq:${seq}` : 'FORM:GN_PROJETO:novo:P';
      }
      if (path.startsWith('PKG_PROJETO.pp_lista_inst')) {
        return (
          opts.pages?.vinculos ??
          `<a href="javascript:preencherOpener('Professor Adjunto','3','1','2019','','40','Servidor público','D001000000998','UNIVERSIDADE DE EXEMPLO');seleciona('D001000000998','UNIVERSIDADE DE EXEMPLO')">UNIVERSIDADE DE EXEMPLO</a>
           <a href="javascript:preencherOpener('Bolsista','','0','2016','2018','40','Outro','V007900000004','UNIVERSIDADE ESTADUAL DE CAMPINAS')">UNICAMP</a>`
        );
      }
      return '';
    },
    menuHtml: () =>
      `<a href="pkg_projeto.lista?f_cod_tipo=P&amp;f_cod=${CV}">Projetos de pesquisa</a>
       <a href="pkg_projeto.lista?f_cod_tipo=E&amp;f_cod=${CV}">Projetos de extensão</a>`,
    async post(path: string, body: string) {
      const values = decodeBody(body);
      posts.push({ body: values, path });
      posted = true;
      if (opts.logonOnPost) return LOGON;
      for (let i = 0; i < (opts.created ?? 1); i++) {
        rows.push({ ...values, ...opts.tamper, f_ctr: 'U', f_seq_proj: String(rows.length + 1) });
      }
      return '';
    },
    readForm(html: string, form: string) {
      const m = /^FORM:(\w+):(seq|novo):(\w*)$/.exec(html);
      if (!m || m[1] !== form) return undefined;
      if (m[2] === 'seq') {
        const row = rows.find((r) => r.f_seq_proj === m[3]);
        return row ? controlsFrom(row, types) : undefined;
      }
      return controlsFrom(
        {
          f_cod: CV,
          f_cod_tipo: 'P',
          f_ctr: opts.ctr ?? 'I',
          f_tematica: 'X',
          f_tpo_acao_inov: 'X',
          f_tpo_cooperacao: 'X',
        },
        types,
      );
    },
  };
  return { port, posts, rows };
}
