// Nomes dos campos dos formulários do Lattes, como a pessoa os conhece.
// Compartilhado pelo painel da extensão e pela confirmação do envio no editor.

import { CREATE_FIELD_LABELS, CREATE_VALUE_LABELS } from './create-labels.ts';

export const FIELD_LABELS: Record<string, string> = {
  ...CREATE_FIELD_LABELS,
  f_ano_fim: 'Ano de fim',
  f_ano_ini: 'Ano de início',
  f_carga: 'Carga horária',
  F_COMPR: 'Compreensão',
  F_CONVERSA: 'Fala',
  f_enqua: 'Enquadramento',
  f_enqua_en: 'Enquadramento (inglês)',
  F_ESCREVE: 'Escrita',
  F_LE: 'Leitura',
  f_mes_fim: 'Mês de fim',
  f_mes_ini: 'Mês de início',
  f_outras_inf: 'Outras informações',
  f_outras_inf_en: 'Outras informações (inglês)',
  f_regime: 'Dedicação exclusiva',
  f_status: 'Situação',
  f_stavinc: 'Vínculo empregatício',
  F_TEXTO: 'Resumo',
  F_TEXTO_EN: 'Resumo (inglês)',
  f_vinc: 'Tipo de vínculo',
};

export function fieldLabel(name: string): string {
  return FIELD_LABELS[name] ?? name;
}

/** Valores codificados nos formulários, por campo. */
const VALUE_LABELS: Record<string, Record<string, string>> = {
  ...CREATE_VALUE_LABELS,
  f_regime: { '3': 'Sim' },
  f_status: { N: 'Anterior', S: 'Atual' },
  f_stavinc: { '0': 'Não', '1': 'Sim' },
};
const LEVELS: Record<string, string> = { B: 'Bem', P: 'Pouco', R: 'Razoavelmente' };

function valueLabel(name: string, value: string | null | undefined): string {
  const level = /^F_(LE|CONVERSA|ESCREVE|COMPR)$/.test(name);
  // Caixa desmarcada some do envio: no regime quer dizer "não".
  if (!value) return level ? 'Não informado' : name === 'f_regime' ? 'Não' : '(vazio)';
  return (level ? LEVELS : VALUE_LABELS[name])?.[value] ?? value;
}

/**
 * Linhas "campo: antes → depois" de uma operação, para quem confere o envio.
 * As caixas FC_* do idioma só acompanham o nível e não aparecem.
 */
export function opRows(op: {
  expect: Record<string, string | null>;
  set: Record<string, string | null>;
}): { after: string; before: string; label: string; name: string }[] {
  return (
    Object.entries(op.set)
      // As caixas FC_* acompanham o nível; f_vinculo repete f_vinc.
      .filter(([name]) => !name.startsWith('FC_') && name !== 'f_vinculo')
      .map(([name, value]) => ({
        after: valueLabel(name, value),
        before: valueLabel(name, op.expect[name]),
        label: fieldLabel(name),
        name,
      }))
  );
}
