// Entrada única do Panorama: o editor importa daqui e de mais nenhum lugar
// desta pasta. Se o Panorama virar recurso pago, a trava fica aqui e no
// controle "Currículo | Panorama", sem mexer no editor.

import './panorama.css';

export type { OpenTarget } from './drill.ts';
export { type Mode, ModeSwitch } from './ModeSwitch.tsx';
export { chartOfAction, panoramaPaletteEntries } from './palette.ts';
export { PanoramaNav } from './PanoramaNav.tsx';
export { PanoramaView } from './PanoramaView.tsx';
export { type PanoramaMode, usePanorama } from './use-panorama.ts';
