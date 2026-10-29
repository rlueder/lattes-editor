// Incluir uma licença (maternidade, paternidade ou adoção) pelo formulário
// GN_LICENCA, POST PKG_LICENCA.FORM com f_ctr I (captura de 13/10/2026, seção
// 21). O check() exige o tipo, o início, o fim e a data de nascimento ou
// adoção (f_dta_nasc_adoc), o início depois dela e um período de até 180
// dias. A data de nascimento ou adoção é o DATA-NASCIMENTO-ADOCAO da
// exportação (vista em 29/10/2026, seção 29). Incluídas e conferidas no
// Lattes real em 28 e 29/10/2026 (seções 27 e 29).

import { getAttr, type XElement } from '../model/xml.ts';
import { licenseToForm } from '../schema/license-types.ts';
import type { CreateGeneralOp } from './create-general.ts';
import { formDate } from './create-registro-rules.ts';
import type { Planned } from './create-shared.ts';

/** O campo do formulário, e o motivo de ir à mão sem a data. */
export const BIRTH_FIELD = 'f_dta_nasc_adoc';
export const BIRTH_ASK =
  'Licença: o Lattes exige a data de nascimento ou adoção; preencha no editor';

/** Uma data dd/mm/aaaa como dias desde 1970, ou undefined. */
function days(date: string): number | undefined {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(date);
  if (!m) return undefined;
  const t = Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  const d = new Date(t);
  if (d.getUTCDate() !== Number(m[1]) || d.getUTCMonth() !== Number(m[2]) - 1) return undefined;
  return t / 86_400_000;
}

/** O período mais longo que o check() aceita. */
const MAX_DAYS = 180;

export function planLicenca(
  change: { key: string },
  el: XElement,
  label: string,
): Planned<CreateGeneralOp> {
  const type = licenseToForm(getAttr(el, 'TIPO-LICENCA') ?? '');
  if (!type) return { reason: 'O Lattes exige o tipo da licença' };
  const start = formDate(getAttr(el, 'DATA-INICIO-LICENCA') ?? '');
  const end = formDate(getAttr(el, 'DATA-FIM-LICENCA') ?? '');
  if (!start || !end) return { reason: 'O Lattes exige o início e o fim da licença' };
  const birthXml = (getAttr(el, 'DATA-NASCIMENTO-ADOCAO') ?? '').trim();
  if (!birthXml) return { reason: BIRTH_ASK };
  const birth = formDate(birthXml) ?? birthXml;
  const [b, s, e] = [days(birth), days(start), days(end)];
  if (b === undefined) return { reason: 'Data de nascimento ou adoção: use dd/mm/aaaa' };
  if (s === undefined || e === undefined) return { reason: 'Datas da licença: use dd/mm/aaaa' };
  if (s < b) return { reason: 'O Lattes exige o início da licença depois do nascimento ou adoção' };
  if (e < s) return { reason: 'O fim da licença vem antes do início' };
  if (e - s > MAX_DAYS) return { reason: `O Lattes aceita uma licença de até ${MAX_DAYS} dias` };
  return {
    expect: {},
    form: 'licenca',
    key: change.key,
    kind: 'criar-dado',
    label,
    set: { [BIRTH_FIELD]: birth, f_dta_fim: end, f_dta_inicio: start, f_tipo_licenca: type },
  };
}
