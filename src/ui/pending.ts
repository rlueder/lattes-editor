// Texto do aviso de pendências, separado do componente para teste.

const plural = (n: number, one: string, many: string) => (n === 1 ? `1 ${one}` : `${n} ${many}`);

export function pendingMessage(changes: number, items: number): string {
  const parts = [
    changes > 0 ? plural(changes, 'alteração', 'alterações') : '',
    items > 0 ? plural(items, 'item novo', 'itens novos') : '',
  ].filter(Boolean);
  const total = changes + items;
  return `${parts.join(' e ')} ainda ${total === 1 ? 'não está' : 'não estão'} no Lattes.`;
}
