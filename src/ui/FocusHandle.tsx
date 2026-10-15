// Puxador do modo foco na borda esquerda: em tela de toque, sem o passar do
// mouse, é o jeito de abrir o menu de seções escondido.

export function FocusHandle({ onToggle, open }: { open: boolean; onToggle: () => void }) {
  return (
    <button
      aria-expanded={open}
      aria-label={open ? 'Esconder o menu de seções' : 'Mostrar o menu de seções'}
      className="focus-handle"
      type="button"
      onClick={onToggle}
    />
  );
}
