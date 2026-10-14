// Exportar no Lattes simulado: a tela pkg_impcv.get_arquivo (formulário
// PKG_IMP) e o POST PKG_IMPCV.get_arquivo, que devolve o ZIP com um único
// <16 dígitos>.xml, comprimido com deflate (docs/lattes_internals.md, seções
// 10 e 12). O ZIP sai da versão publicada: o que foi gravado e ainda não foi
// enviado ao CNPq não vem (observado em 14/10/2026).

import { crc32, deflateRawSync } from 'node:zlib';

import { encodeCv } from '../../src/model/document.ts';
import type { LattesState } from './estado.ts';
import * as h from './html.ts';
import type { SimRequest } from './pedido.ts';
import { html, type Routes, type SimResponse } from './tipos.ts';

/** O aviso da tela com alteração pendente, observado em 12/10/2026. */
export const PENDING_ALERT =
  'Existem alterações realizadas no currículo que só serão aceitas quando enviadas ao CNPq em definitivo';

/** Um ZIP com uma entrada, comprimida com deflate. */
export function zipOne(name: string, data: Uint8Array): Uint8Array {
  const nameBytes = Buffer.from(name, 'latin1');
  const body = deflateRawSync(data);
  const crc = crc32(data);
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(8, 8);
  local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(body.length, 18);
  local.writeUInt32LE(data.length, 22);
  local.writeUInt16LE(nameBytes.length, 26);
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(20, 4);
  central.writeUInt16LE(20, 6);
  central.writeUInt16LE(8, 10);
  central.writeUInt32LE(crc, 16);
  central.writeUInt32LE(body.length, 20);
  central.writeUInt32LE(data.length, 24);
  central.writeUInt16LE(nameBytes.length, 28);
  const localSize = local.length + nameBytes.length + body.length;
  const centralSize = central.length + nameBytes.length;
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(1, 8);
  end.writeUInt16LE(1, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(localSize, 16);
  return new Uint8Array(Buffer.concat([local, nameBytes, body, central, nameBytes, end]));
}

function screen(state: LattesState): SimResponse {
  if (state.pending) {
    // O alert() trava a aba até alguém clicar em OK, e a tela não exporta.
    return html(
      h.page(
        'Exportar',
        `<script>alert('${h.jsString(PENDING_ALERT)}'); self.parent.fecharModal && self.parent.fecharModal();</script>`,
      ),
    );
  }
  const body = `<form name="PKG_IMP" method="post" action="PKG_IMPCV.get_arquivo">
<p>${h.radios(
    'f_tpo_arq',
    [
      ['1', 'RTF'],
      ['3', 'XML'],
    ],
    '1',
  )}</p>
${h.hidden('f_cod', state.code)}${h.hidden('f_ctr', '')}
<p><a href="#" onclick="check(); return false;">Confirmar</a> <a href="#" onclick="dc.f_ctr.value = 'V'; dc.submit(); return false;">Cancelar</a></p>
</form>
<script>var dc = document.forms['PKG_IMP']; function check(){ dc.f_ctr.value = 'G'; dc.submit(); }</script>`;
  return html(h.page('Exportar', body));
}

function download(req: SimRequest, state: LattesState): SimResponse {
  // Feito a partir de /curriculoweb/, o fetch falha (observado em 14/10/2026).
  if (req.base !== 'cvlattesweb') return { cut: true };
  if (req.get('f_ctr') !== 'G') return screen(state);
  if (state.pending) return screen(state);
  if (req.get('f_tpo_arq') !== '3') {
    return html(h.page('Exportar', '<p>O simulado só exporta em XML (f_tpo_arq=3).</p>'), 501);
  }
  const id = state.lattesId;
  const bytes = zipOne(`${id}.xml`, encodeCv(state.published, 'ISO-8859-1'));
  return {
    bytes,
    contentType: 'application/zip',
    headers: { 'Content-Disposition': `attachment; filename="CV_${id}.zip"` },
  };
}

export const EXPORTAR_ROUTES: Routes = {
  'pkg_impcv.get_arquivo': (req, state) =>
    req.method === 'POST' ? download(req, state) : screen(state),
};
