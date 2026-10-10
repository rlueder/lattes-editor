// Barra de atalhos grudada no topo: um chip por divisão (grupo da seção ou ano
// da lista), com contagem, marcando a divisão visível e pulando para as outras.
//
// Dois níveis empilham: a barra da seção gruda sob o cabeçalho, e a de anos
// gruda sob a da seção. Cada barra publica a própria altura numa variável CSS
// no elemento pai (--section-bar-h, --year-bar-h), que os deslocamentos de
// sticky e de scroll-margin usam.

import { useEffect, useRef, useState } from 'react';

export interface JumpEntry {
  count?: number;
  /** id do título da divisão, no DOM. */
  id: string;
  label: string;
}

export type JumpLevel = 'section' | 'year';

const HEIGHT_VAR: Record<JumpLevel, string> = {
  section: '--section-bar-h',
  year: '--year-bar-h',
};

export function JumpBar({
  entries,
  label,
  level,
}: {
  entries: JumpEntry[];
  label: string;
  level: JumpLevel;
}) {
  const barRef = useRef<HTMLElement>(null);
  const [active, setActive] = useState(entries[0]?.id);
  // A lista é recriada a cada render; a chave só muda quando as divisões mudam.
  const ids = entries.map((e) => e.id).join('|');

  useEffect(() => {
    const bar = barRef.current;
    const host = bar?.parentElement;
    if (!bar || !host) return;
    const name = HEIGHT_VAR[level];
    const observer = new ResizeObserver(() =>
      host.style.setProperty(name, `${bar.offsetHeight}px`),
    );
    observer.observe(bar);
    return () => {
      observer.disconnect();
      host.style.removeProperty(name);
    };
  }, [level]);

  useEffect(() => {
    const headIds = ids.split('|');
    let frame = 0;
    const update = () => {
      frame = 0;
      // Ativa é a última divisão cujo título já passou da borda de baixo da barra.
      const edge = (barRef.current?.getBoundingClientRect().bottom ?? 0) + 8;
      let current = headIds[0];
      for (const id of headIds) {
        const head = document.getElementById(id);
        if (head && head.getBoundingClientRect().top <= edge) current = id;
      }
      setActive(current);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [ids]);

  return (
    <nav ref={barRef} aria-label={label} className={`jump-bar ${level}`}>
      {entries.map((e) => (
        <a
          key={e.id}
          aria-current={e.id === active ? 'location' : undefined}
          className={e.id === active ? 'active' : undefined}
          href={`#${e.id}`}
          onClick={(ev) => {
            // Ids do useId têm ":"; o hash na URL também não acrescenta nada aqui.
            ev.preventDefault();
            document.getElementById(e.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }}
        >
          {e.label}
          {e.count !== undefined && <span className="count">{e.count}</span>}
        </a>
      ))}
    </nav>
  );
}
