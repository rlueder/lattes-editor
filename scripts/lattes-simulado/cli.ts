// pnpm dev:lattes: o Lattes simulado numa porta fixa, para o app, o host
// nativo e a extensão Dev conversarem com ele no navegador. Opções:
//   --porta=5197              porta (padrão 5197)
//   --importar=<resultado>    participante (padrão), inserir ou descartar
//   --gravadas=<pasta>        respostas gravadas (ver servidor.ts)
//   --xml=<arquivo>           outro currículo de partida (sintético; nunca um real)

import { readFileSync } from 'node:fs';

import type { ImportOutcome } from './estado.ts';
import { startLattesSimulado } from './servidor.ts';

const arg = (name: string) =>
  process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);

const outcome = arg('importar') as ImportOutcome | undefined;
if (outcome && !['descartar', 'inserir', 'participante'].includes(outcome)) {
  console.error('--importar aceita participante, inserir ou descartar');
  process.exit(1);
}
const xml = arg('xml');
const lattes = await startLattesSimulado({
  importOutcome: outcome,
  port: Number(arg('porta') ?? 5197),
  recordings: arg('gravadas'),
  xml: xml ? new Uint8Array(readFileSync(xml)) : undefined,
});

console.log(`Lattes simulado em ${lattes.base}PKG_MENU.menu`);
console.log(`Estado: ${lattes.url}/__simulado/estado`);
console.log(
  `Controle (POST): ${lattes.url}/__simulado/expirar, /entrar, /publicar, /importacao?resultado=…`,
);
