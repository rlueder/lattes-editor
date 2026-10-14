// O relatório da verificação do contrato (contract.ts) em texto, para o painel
// e para colar numa issue. Só nomes de campos e procedimentos; nenhum valor.

import type { ContractReport, Drift, DriftKind, FormStatus } from './contract.ts';
import { listText } from './list-watch.ts';

const DRIFT_TEXT: Record<DriftKind, (d: Drift) => string> = {
  'campo-novo': (d) => `${d.form}: campo novo ${d.field}`,
  'campo-sumiu': (d) => `${d.form}: campo ${d.field} sumiu`,
  'formulario-sumiu': (d) => `${d.form}: formulário não encontrado na página`,
  'limite-mudou': (d) => `${d.form}: limite de ${d.field} era ${d.expected}, agora ${d.observed}`,
  'link-sumiu': (d) => `${d.form}: link ${d.field} sumiu`,
  'modo-mudou': (d) => `${d.form}: ${d.field} era ${d.expected}, agora ${d.observed}`,
  'tipo-mudou': (d) => `${d.form}: ${d.field} era ${d.expected}, agora ${d.observed}`,
};

export function driftText(drift: Drift): string {
  return DRIFT_TEXT[drift.kind](drift);
}

const FORM_STATUS: Record<FormStatus, string> = {
  mudou: 'mudou',
  'nao-encontrado': 'não encontrado',
  ok: 'como o esperado',
  'sem-amostra': 'sem amostra',
};

/**
 * Relatório em texto, para colar numa issue: data, versão da extensão, menu
 * e formulários. Só nomes de campos e procedimentos; nenhum valor.
 */
export function reportText(report: ContractReport, version: string): string {
  const lines = [
    `Verificação do Lattes em ${report.checkedAt}`,
    `Extensão ${version}`,
    `Resultado: ${report.status}${report.detail ? ` (${report.detail})` : ''}`,
  ];
  if (report.menu.length) {
    lines.push('', 'Menu:');
    for (const m of report.menu) lines.push(`- ${m.proc}: ${m.found ? 'ok' : 'sumiu'}`);
  }
  for (const f of report.forms) {
    lines.push('', `${f.form}: ${FORM_STATUS[f.status]}${f.detail ? ` (${f.detail})` : ''}`);
    for (const d of f.drifts) lines.push(`- ${driftText(d)}`);
  }
  if (report.lists?.length) {
    lines.push('', 'Listas dos campos tipados:');
    for (const l of report.lists)
      lines.push(`- ${l.status === 'ok' ? `${l.label}: ok` : listText(l)}`);
  }
  return lines.join('\n');
}

export const ISSUES_URL = 'https://github.com/rlueder/lattes-editor/issues/new';

/** Link que abre uma issue já preenchida com o relatório. */
export function issueUrl(report: ContractReport, version: string): string {
  const title = `O Lattes mudou: ${[
    ...report.forms.filter((f) => f.drifts.length).map((f) => f.form),
    ...(report.lists ?? []).filter((l) => l.status !== 'ok').map((l) => l.label),
  ].join(', ')}`.replace(/: $/, '');
  const params = new URLSearchParams({
    body: `\`\`\`\n${reportText(report, version)}\n\`\`\``,
    labels: 'vigia-lattes',
    title,
  });
  return `${ISSUES_URL}?${params.toString()}`;
}
