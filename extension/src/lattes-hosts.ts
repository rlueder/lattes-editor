// Onde a extensão procura o Lattes. A publicada só conhece wwws.cnpq.br. A do
// canal Dev também acha o Lattes simulado (pnpm dev:lattes, em
// scripts/lattes-simulado/), em localhost, para testar o app, o host nativo e
// a extensão de ponta a ponta sem um currículo de verdade. A escolha é feita
// na montagem: quem chama decide por __CANAL_DEV__ (scripts/build-extension.ts),
// e na extensão publicada o ramo do simulado sai do código montado e o
// manifest não pede permissão para localhost.

/** O menu do currículo no Lattes: é nessa aba que as requisições rodam. */
export const LATTES_MENU = 'https://wwws.cnpq.br/cvlattesweb/PKG_MENU.menu*';

/** O menu do Lattes simulado, em qualquer porta (o padrão de host sem porta casa todas). */
export const SIMULATED_MENUS = [
  'http://localhost/cvlattesweb/PKG_MENU.menu*',
  'http://127.0.0.1/cvlattesweb/PKG_MENU.menu*',
];

/** Permissões de host do manifest: o simulado só no canal Dev. */
export function hostPermissions(devChannel: boolean): string[] {
  const real = ['https://wwws.cnpq.br/*'];
  return devChannel ? [...real, 'http://localhost/*', 'http://127.0.0.1/*'] : real;
}

/** Os padrões de URL do menu que a extensão aceita como aba do Lattes. */
export function lattesMenus(devChannel: boolean): string[] {
  return devChannel ? [LATTES_MENU, ...SIMULATED_MENUS] : [LATTES_MENU];
}

const SIMULATED_MENU_URL =
  /^http:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?\/cvlattesweb\/PKG_MENU\.menu/i;

/** A URL é a do menu do Lattes de verdade? */
export function isRealLattesMenu(url: string | undefined): boolean {
  return Boolean(url?.startsWith(LATTES_MENU.replace(/\*$/, '')));
}

/** A URL é a do menu do Lattes ou, no canal Dev, a do simulado? */
export function isLattesMenu(url: string | undefined, devChannel: boolean): boolean {
  if (isRealLattesMenu(url)) return true;
  return devChannel && SIMULATED_MENU_URL.test(url ?? '');
}
