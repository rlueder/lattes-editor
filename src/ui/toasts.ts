// Avisos no canto da tela (Base UI Toast), como os do app da Precisa: um título,
// uma frase e, quando há o que fazer, um botão. O gerenciador fica fora do
// React para qualquer módulo poder avisar.

import { Toast } from '@base-ui/react/toast';

export const toasts = Toast.createToastManager();
