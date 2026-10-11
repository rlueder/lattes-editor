// Barra de atalhos grudada no topo: um chip por divisão (grupo da seção ou ano
// da lista), sem contagem (o título da divisão já mostra), marcando a divisão visível e pulando para as outras.
//
// Dois níveis empilham: a barra da seção gruda sob o cabeçalho, e a de anos
// gruda sob a da seção. Cada barra publica a própria altura numa variável CSS
// no elemento pai (--section-bar-h, --year-bar-h), que os deslocamentos de
// sticky e de scroll-margin usam.

import { useEffect, useRef, useState } from 'react';

import { Tip } from './primitives/Tip.tsx';

/** Igual ao max-width de .jump-label (14ch). */
const MAX_LABEL = 14;

export interface JumpEntry {
  /** id do título da divisão, no DOM. */
  id: string;
  label: string;
}

export type JumpLevel = 'section' | 'year';

const HEIGHT_VAR: Record<JumpLevel, string> = {
  section: '--section-bar-h',
  year: '--year-bar-h',
};

/** Atualiza a URL sem criar entrada no histórico do navegador. */
function setHash(id: string): void {
  history.replaceState(null, '', `#${id}`);
}

export function JumpBar({
  entries,
  label,
  level,
  linkable = false,
  vertical = false,
}: {
  entries: JumpEntry[];
  label: string;
  level: JumpLevel;
  /** Ids legíveis: o clique também atualiza a URL. */
  linkable?: boolean;
  /** Lista vertical no painel lateral: não gruda nem publica altura. */
  vertical?: boolean;
}) {
  const barRef = useRef<HTMLElement>(null);
  const [active, setActive] = useState(entries[0]?.id);
  // A lista é recriada a cada render; a chave só muda quando as divisões mudam.
  const ids = entries.map((e) => e.id).join('|');

  useEffect(() => {
    const bar = barRef.current;
    const host = bar?.parentElement;
    if (!bar || !host || vertical) return;
    const name = HEIGHT_VAR[level];
    const observer = new ResizeObserver(() =>
      host.style.setProperty(name, `${bar.offsetHeight}px`),
    );
    observer.observe(bar);
    return () => {
      observer.disconnect();
      host.style.removeProperty(name);
    };
  }, [level, vertical]);

  // Depois de um clique, a rolagem suave passa por outras divisões; o chip
  // clicado fica ativo até a rolagem parar.
  const lockedTo = useRef<string | null>(null);

  useEffect(() => {
    const headIds = ids.split('|');
    let frame = 0;
    let settle = 0;
    const update = () => {
      frame = 0;
      if (lockedTo.current) return;
      // Ativa é a última divisão cujo título já passou da borda de baixo da barra.
      // A folga cobre o arredondamento de scroll-margin, que põe o título na borda.
      // Na lista vertical, a borda é o cabeçalho da página.
      const edgeEl = vertical ? document.querySelector('.topbar') : barRef.current;
      const edge = (edgeEl?.getBoundingClientRect().bottom ?? 0) + 24;
      let current = headIds[0];
      for (const id of headIds) {
        const head = document.getElementById(id);
        if (head && head.getBoundingClientRect().top <= edge) current = id;
      }
      // No fim da página, as últimas divisões não sobem até a barra: vale a última visível.
      const atBottom =
        window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
      if (atBottom) {
        for (const id of headIds) {
          const head = document.getElementById(id);
          if (head && head.getBoundingClientRect().top < window.innerHeight) current = id;
        }
      }
      setActive(current);
    };
    const schedule = () => {
      if (lockedTo.current) {
        // Fim da rolagem: sem eventos por um instante (scrollend não existe em todo navegador).
        clearTimeout(settle);
        settle = window.setTimeout(() => {
          lockedTo.current = null;
        }, 150);
        return;
      }
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      if (frame) cancelAnimationFrame(frame);
      clearTimeout(settle);
    };
  }, [ids, vertical]);

  return (
    <nav
      ref={barRef}
      aria-label={label}
      className={`jump-bar ${level}${vertical ? ' vertical' : ''}`}
    >
      {entries.map((e) => {
        const chip = (
          <a
            key={e.id}
            aria-current={e.id === active ? 'location' : undefined}
            className={e.id === active ? 'active' : undefined}
            href={`#${e.id}`}
            onClick={(ev) => {
              ev.preventDefault();
              if (linkable) setHash(e.id);
              setActive(e.id);
              lockedTo.current = e.id;
              document.getElementById(e.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
          >
            <span className="jump-label">{e.label}</span>
          </a>
        );
        // Rótulo cortado (14ch no CSS) mostra o nome inteiro na dica.
        return e.label.length > (vertical ? 26 : MAX_LABEL) ? (
          <Tip key={e.id} label={e.label}>
            {chip}
          </Tip>
        ) : (
          chip
        );
      })}
    </nav>
  );
}
