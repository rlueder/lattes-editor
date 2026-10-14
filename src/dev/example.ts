// Currículo de exemplo para testar o editor sem um currículo real: com
// ?exemplo na URL e nenhum currículo aberto, carrega
// fixtures/synthetic_full.xml, que tem todo elemento e todo atributo do
// schema (todas as seções preenchidas, todos os valores falsos).
//
// Só existe no `pnpm dev`: main.tsx importa este módulo atrás de
// import.meta.env.DEV, e no build ele nem entra no bundle. `pnpm dev:exemplo`
// abre o editor numa porta própria, e o IndexedDB, que é por origem, fica
// separado do currículo de verdade aberto na porta padrão.

import type { BridgeOp } from '../bridge/plan.ts';
import { sentEntry, undoOp } from '../bridge/sent-log.ts';
import { loadCv } from '../model/document.ts';
import {
  addSent,
  listSent,
  loadWorkingCopy,
  newWorkingCopy,
  replaceWorkingCopy,
} from '../model/store.ts';
import { getAttr, parseXml } from '../model/xml.ts';

export const EXAMPLE_URL = '/fixtures/synthetic_full.xml';

/**
 * O currículo de demonstração (?exemplo=demo, pnpm dev:demo): uma pesquisadora
 * fictícia com dados críveis, para gravar o app e tirar imagens. Gerado por
 * scripts/gen-demo.ts.
 */
export const DEMO_URL = '/fixtures/demo.xml';

/** NUMERO-IDENTIFICADOR da fixture; os envios fictícios só entram nesse currículo. */
export const EXAMPLE_LATTES_ID = '0000000000000001';

/** Abre o exemplo se a URL pedir e não houver currículo; devolve se abriu. */
export async function openExampleIfAsked(search: string): Promise<boolean> {
  const params = new URLSearchParams(search);
  if (!params.has('exemplo')) return false;
  const demo = params.get('exemplo') === 'demo';
  // Um currículo já aberto (o exemplo editado, ou outro) nunca é substituído.
  const open = await loadWorkingCopy();
  if (open) {
    await seedSentLog(open.xml);
    return false;
  }
  const url = demo ? DEMO_URL : EXAMPLE_URL;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} respondeu ${res.status}`);
  const cv = await loadCv(
    new Uint8Array(await res.arrayBuffer()),
    demo ? 'CV_3871592046158372.zip' : 'synthetic_full.xml',
  );
  const copy = newWorkingCopy(cv, Date.now());
  await replaceWorkingCopy(copy);
  await seedSentLog(copy.xml);
  return true;
}

const HOUR = 60 * 60 * 1000;

/** Envios fictícios: um vínculo, um idioma e um resumo, este já desfeito. */
function exampleOps(): BridgeOp[] {
  return [
    {
      codInst: 'D000000000001',
      expect: { f_ano_fim: '', f_ano_ini: '2018', f_mes_ini: '3', f_status: 'S' },
      key: 'exemplo-vinculo',
      kind: 'vinculo',
      label: 'Vínculo: Universidade Federal de Exemplo',
      seqAtiv: '1',
      seqHist: '1',
      set: { f_ano_fim: '2025', f_status: 'N' },
    },
    {
      code: 'EN',
      expect: { F_CONVERSA: 'R', F_ESCREVE: 'R' },
      key: 'exemplo-idioma',
      kind: 'idioma',
      label: 'Idioma: Inglês',
      set: { F_CONVERSA: 'B', F_ESCREVE: 'B' },
    },
    {
      expect: { F_TEXTO: 'Professora e pesquisadora em ecologia de populações.' },
      key: 'exemplo-resumo',
      kind: 'resumo',
      label: 'Resumo',
      set: {
        F_TEXTO:
          'Professora e pesquisadora em ecologia de populações, com foco em polinizadores do Cerrado.',
      },
    },
  ];
}

/**
 * Preenche "Enviado ao Lattes" do exemplo, para dar o que ver sem extensão
 * nem Lattes: dois envios de ontem, um de hoje e o desfazer dele. Só no
 * currículo de exemplo, e só quando o registro dele está vazio: um currículo
 * de verdade aberto com ?exemplo nunca ganha envios inventados.
 */
async function seedSentLog(xml: string | undefined): Promise<void> {
  const lattesId = xml && getAttr(parseXml(xml).root, 'NUMERO-IDENTIFICADOR');
  if (lattesId !== EXAMPLE_LATTES_ID || (await listSent(lattesId)).length) return;
  const now = Date.now();
  const [vinculo, idioma, resumo] = exampleOps();
  await addSent(sentEntry(vinculo!, lattesId, now - 26 * HOUR));
  await addSent(sentEntry(idioma!, lattesId, now - 25 * HOUR));
  const entry = sentEntry(resumo!, lattesId, now - 2 * HOUR);
  const id = await addSent(entry);
  const undo = undoOp({ ...entry, id });
  if (undo) await addSent(sentEntry(undo, lattesId, now - HOUR, { undoOf: id }));
}
