// Confere a geometria dos controles com o CSS real, sem abrir um currículo.
// As molduras reproduzem o Modal comum e os dois formulários de item.
import { readFileSync } from 'node:fs';

import { openTab, withHeadlessBrowser } from './headless.ts';

const css = readFileSync(new URL('../src/ui/styles.css', import.meta.url), 'utf8');
const icon = '<svg class="icon-svg" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" /></svg>';
const controls = `<button class="ghost icon-btn modal-close" aria-label="Expandir">${icon}</button>
  <button class="ghost icon-btn modal-close" aria-label="Fechar">${icon}</button>`;
const fixtures = [
  {
    header: `<div class="modal-titles"><h2>Histórico de alterações</h2>
      <p class="modal-subtitle">Os últimos 50 estados fictícios, incluindo a cópia antes de cada envio.
      Restaurar volta o currículo ao ponto escolhido. Salvar cópia grava esse ponto num arquivo.</p></div>
      <button class="ghost icon-btn modal-close" aria-label="Fechar">${icon}</button>`,
    name: 'histórico',
  },
  {
    header: `<nav class="crumbs"><span class="crumb">Formação</span>
      <h2 class="crumb-current">Formação acadêmica de exemplo com um título longo</h2></nav>${controls}`,
    name: 'formulário geral',
  },
  {
    header: `<nav class="crumbs"><span class="crumb">Novo item</span>
      <h2 class="crumb-current">Produção de exemplo com um título longo</h2></nav>
      <span class="seq muted">nº 12345</span>${controls}`,
    name: 'produção',
  },
];

interface Measurement {
  control: string;
  fixture: string;
  height: number;
  inside: boolean;
  radius: string;
  theme: string;
  viewport: number;
  width: number;
}

await withHeadlessBrowser(async () => {
  const cdp = await openTab();
  try {
    const { frameTree } = await cdp.send<{ frameTree: { frame: { id: string } } }>(
      'Page.getFrameTree',
    );
    await cdp.send('Page.setDocumentContent', {
      frameId: frameTree.frame.id,
      html: `<!doctype html><html lang="pt-BR"><head><style>${css}</style></head><body></body></html>`,
    });
    const measurements: Measurement[] = [];
    for (const viewport of [360, 600, 1000]) {
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        deviceScaleFactor: 1,
        height: 800,
        mobile: false,
        width: viewport,
      });
      const { result } = await cdp.send<{ result: { value?: Measurement[] } }>('Runtime.evaluate', {
        expression: `(() => {
          const measurements = [];
          for (const theme of ['light', 'dark']) {
            document.documentElement.dataset.theme = theme;
            for (const [index, fixture] of ${JSON.stringify(fixtures)}.entries()) {
              document.body.innerHTML = '<section class="modal' + (index ? ' form-modal' : '') + '">' +
                '<header class="modal-head' + (index ? ' modal-crumbs' : '') + '">' + fixture.header + '</header></section>';
              const head = document.querySelector('.modal-head').getBoundingClientRect();
              for (const button of document.querySelectorAll('.modal-close')) {
                const rect = button.getBoundingClientRect();
                measurements.push({
                  control: button.getAttribute('aria-label'), fixture: fixture.name,
                  height: rect.height, inside: rect.left >= head.left && rect.right <= head.right,
                  radius: getComputedStyle(button).borderRadius, theme,
                  viewport: ${viewport}, width: rect.width,
                });
              }
            }
          }
          return measurements;
        })()`,
        returnByValue: true,
      });
      if (!result.value?.length) throw new Error('O navegador não mediu os controles dos modais.');
      measurements.push(...result.value);
    }
    const failures = measurements.filter(
      (m) =>
        Math.abs(m.width - m.height) > 0.1 || m.width !== 30 || m.radius !== '50%' || !m.inside,
    );
    if (failures.length) {
      throw new Error(`Controles deformados ou fora do cabeçalho: ${JSON.stringify(failures)}`);
    }
    console.log(
      `${measurements.length} controles circulares conferidos, em três larguras e nos dois temas.`,
    );
  } finally {
    cdp.close();
  }
});
