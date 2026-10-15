// Barra compacta que desliza para dentro do painel de conteúdo quando o
// título da seção sai da tela: "Seção › Grupo", com o grupo visível no
// momento. Enquanto aparece, publica a própria altura em --section-bar-h, que
// as barras de anos e as âncoras já somam no deslocamento.

import { type ReactNode, type RefObject, useEffect, useState } from 'react';

const BAR_H = 44;

interface Props {
  /** Ações da seção (o olho de privacidade, "Nova formação"…), as mesmas que ficam sob o título. */
  actions?: ReactNode;
  groups: { id: string; label: string }[];
  /** Raiz da seção, onde a altura da barra é publicada. */
  host: RefObject<HTMLElement | null>;
  label: string;
  /** Título da seção; a barra aparece quando ele some. */
  title: RefObject<HTMLElement | null>;
}

export function StickyTitle({ actions, groups, host, label, title }: Props) {
  const [visible, setVisible] = useState(false);
  const [current, setCurrent] = useState<string | undefined>();
  const ids = groups.map((g) => g.id).join('|');

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const top = document.querySelector('.topbar')?.getBoundingClientRect().bottom ?? 0;
      const head = title.current?.getBoundingClientRect();
      const show = head ? head.bottom < top : false;
      setVisible(show);
      let active: string | undefined;
      for (const id of ids.split('|')) {
        const el = id && document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= top + BAR_H + 24) active = id;
      }
      setCurrent(active);
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
  }, [ids, title]);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    if (visible) el.style.setProperty('--section-bar-h', `${BAR_H}px`);
    else el.style.removeProperty('--section-bar-h');
  }, [host, visible]);

  const group = groups.find((g) => g.id === current);
  return (
    // Escondida, a barra sai da ordem do Tab (inert): as ações dela são as
    // mesmas que estão sob o título, à vista.
    <div
      aria-hidden={!visible}
      className={`sticky-title${visible ? ' visible' : ''}`}
      inert={!visible}
    >
      <div className="sticky-title-bar">
        <div className="sticky-title-main">
          <strong>{label}</strong>
          {group && (
            <>
              <span className="sticky-title-sep">›</span>
              <span className="sticky-title-group">{group.label}</span>
            </>
          )}
          {actions && <span className="sticky-title-actions">{actions}</span>}
        </div>
      </div>
    </div>
  );
}
