// FLAG-VINCULO-EMPREGATICIO da exportação é o inverso do campo f_stavinc
// ("Possui vínculo empregatício", opções vazio, 0 = Não, 1 = Sim) dos
// formulários do Lattes. Observado em 15/10/2026: a passada de edição do
// censo (LAT-55) casou os 8 vínculos do dono com f_stavinc 0 ↔ SIM e
// 1 ↔ NAO, e a tela confirmou um deles (o Lattes mostra "Sim", f_stavinc=1
// marcado no HTML, e a exportação traz NAO). A dedicação exclusiva
// (f_regime, caixa de valor 3) não é invertida: desmarcada no Lattes, NAO
// na exportação. Ver docs/lattes_internals.md, seções 5 e 20.
//
// Toda tradução do conector entre o XML e f_stavinc passa por aqui (o Lattes
// simulado tem um mapa literal próprio, para conferir este); o censo usa
// INVERTED_FLAGS para não acusar a inversão como divergência (e acusar se ela
// deixar de existir).

/** Campo do formulário → atributo do XML cujo SIM/NAO é o inverso do código da opção. */
export const INVERTED_FLAGS: Readonly<Record<string, string>> = {
  f_stavinc: 'FLAG-VINCULO-EMPREGATICIO',
};

/** f_stavinc a partir do XML: SIM → 0, NAO → 1, o resto → vazio. */
export const stavincFromFlag = (v: string | undefined): string =>
  v === 'SIM' ? '0' : v === 'NAO' ? '1' : '';

/** FLAG-VINCULO-EMPREGATICIO a partir de f_stavinc: 0 → SIM, 1 → NAO, o resto → vazio. */
export const flagFromStavinc = (v: string | undefined): string =>
  v === '0' ? 'SIM' : v === '1' ? 'NAO' : '';
