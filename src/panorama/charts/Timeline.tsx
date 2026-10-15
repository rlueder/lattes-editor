// Linha do tempo com rolagem horizontal e zoom, como as visões de roteiro
// (Linear, GitHub Projects): o período do painel é a janela visível, rótulos
// das faixas fixos à esquerda, eixo de
// anos no alto, marca de hoje, arrastar para os lados e ⌘/Ctrl + roda (ou
// pinça) para aproximar. O rótulo fica dentro da barra quando cabe e ao lado
// quando não cabe; o texto inteiro aparece na dica.

import { type PointerEvent, useEffect, useLayoutEffect, useRef, useState } from 'react';

import type { Period } from '../aggregate.ts';
import type { CvData } from '../model.ts';
import {
  LANES,
  pack,
  scaleFor,
  tickStep,
  timelineEntries,
  type TimelineEntry,
  zoomAt,
} from '../timeline.ts';
import { Legend, Mark } from './shared.tsx';

interface Props {
  cv: CvData;
  now: number;
  /** A janela visível; com o período inteiro, vai do primeiro item até hoje. */
  period: Period;
  whole: boolean;
}

const AXIS = 26;
const ROW = 24;
const LANE_GAP = 12;
const CHAR = 6.2;
const PAD = 12;

interface Geo {
  e: TimelineEntry;
  /** Onde fica o rótulo: dentro da barra, à direita ou à esquerda dela. */
  place: 'dentro' | 'direita' | 'esquerda';
  x0: number;
  x1: number;
}

/** Fração do ano corrente já passada, para a marca de hoje. */
const yearFraction = () => {
  const d = new Date();
  return (d.getMonth() + d.getDate() / 31) / 12;
};

export function Timeline({ cv, now, period, whole }: Props) {
  const entries = timelineEntries(cv);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  const first = entries[0]?.start ?? now;
  // A janela visível: o período do painel, ou do primeiro item até hoje.
  const from = whole ? first : Math.max(first, period.from);
  const to = whole ? now : Math.max(from, Math.min(now, period.to));
  const windowYears = to + 1 - from;
  const fit = scaleFor(width - 2 * PAD, now + 1 - first);
  const [scale, setScale] = useState(() => scaleFor(width - 2 * PAD, windowYears));
  // Onde a área visível começa: o rótulo dentro da barra acompanha a rolagem.
  const [scrollX, setScrollX] = useState(0);
  const drag = useRef<{ moved: boolean; x: number; left: number } | null>(null);

  // A largura visível define a escala da janela.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  // Trocar o período recalcula a escala; depois de desenhar, a vista começa no
  // primeiro ano da janela.
  const toWindow = useRef(true);
  useLayoutEffect(() => {
    toWindow.current = true;
    setScale(scaleFor(width - 2 * PAD, windowYears));
  }, [width, windowYears, from]);
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el || !toWindow.current) return;
    toWindow.current = false;
    el.scrollLeft = (from - first) * scale;
  }, [scale, from, first]);

  // ⌘/Ctrl + roda, e a pinça do trackpad (que chega como roda com Ctrl), aproximam.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (ev: WheelEvent) => {
      if (!ev.ctrlKey && !ev.metaKey) return;
      ev.preventDefault();
      const x = ev.clientX - el.getBoundingClientRect().left;
      setScale((s) => {
        const next = zoomAt(s, el.scrollLeft, x, Math.exp(-ev.deltaY / 400), fit);
        requestAnimationFrame(() => (el.scrollLeft = next.scrollLeft));
        return next.scale;
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [fit]);

  if (entries.length === 0) return <p className="pano-note">Nada com período neste currículo.</p>;

  const sx = (year: number) => PAD + (year - first) * scale;
  const lanes = LANES.filter((l) => entries.some((e) => e.lane === l));
  let top = AXIS + 8;
  const today = sx(now + yearFraction());
  const edge = sx(now + 1);
  let right = edge + PAD;
  const layout = lanes.map((lane) => {
    const list = entries.filter((e) => e.lane === lane);
    const geo: Geo[] = list.map((e) => {
      const x0 = sx(e.start);
      // Em andamento termina na marca de hoje.
      const x1 = e.point ? x0 + 14 : Math.max(e.end ? sx(e.end + 1) : today, x0 + 6);
      const text = e.label.length * CHAR;
      // Dentro quando cabe; senão à direita, sem passar de hoje; senão à esquerda.
      const place: Geo['place'] =
        !e.point && text + 14 <= x1 - x0
          ? 'dentro'
          : x1 + 6 + text <= edge || x0 - 6 - text < PAD
            ? 'direita'
            : 'esquerda';
      return { e, place, x0, x1 };
    });
    const textOf = (g: Geo) => g.e.label.length * CHAR;
    const begin = (g: Geo) => (g.place === 'esquerda' ? g.x0 - 6 - textOf(g) : g.x0);
    const extent = (g: Geo) => (g.place === 'direita' ? g.x1 + 6 + textOf(g) : g.x1);
    const rows = pack(geo, begin, extent, 8);
    for (const g of geo) right = Math.max(right, extent(g) + PAD);
    const block = { geo, lane, rows, top };
    top += Math.max(1, ...rows.map((r) => r + 1)) * ROW + LANE_GAP;
    return block;
  });
  const H = top;
  const W = Math.max(width, right);
  const step = tickStep(scale);
  const ticks: number[] = [];
  for (let t = first; t <= now; t++) if ((t - first) % step === 0 || t === now) ticks.push(t);

  // Arrastar o fundo rola para os lados; um clique sem arrasto segue para a barra.
  const onPointerDown = (ev: PointerEvent<HTMLDivElement>) => {
    if (ev.button !== 0 || !scrollRef.current) return;
    drag.current = { left: scrollRef.current.scrollLeft, moved: false, x: ev.clientX };
  };
  const onPointerMove = (ev: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    const el = scrollRef.current;
    if (!d || !el) return;
    const dx = ev.clientX - d.x;
    if (Math.abs(dx) > 4) d.moved = true;
    if (d.moved) el.scrollLeft = d.left - dx;
  };
  const endDrag = () => {
    drag.current = null;
  };

  return (
    <>
      <Legend
        items={[
          { color: 'var(--accent)', label: 'Concluído' },
          { color: 'var(--accent)', label: 'Em andamento', shape: 'ring' },
          { color: 'var(--accent)', label: 'Ponto: orientação concluída ou prêmio' },
        ]}
      />
      <div className="pano-tl">
        <div aria-hidden="true" className="pano-tl-lanes" style={{ height: H }}>
          {layout.map((b) => (
            <span key={b.lane} style={{ top: b.top + 4 }}>
              {b.lane}
            </span>
          ))}
        </div>
        {}
        <div
          ref={scrollRef}
          className="pano-tl-scroll"
          onClickCapture={(ev) => {
            if (drag.current?.moved) ev.stopPropagation();
          }}
          onPointerCancel={endDrag}
          onPointerDown={onPointerDown}
          onPointerLeave={endDrag}
          onPointerMove={onPointerMove}
          onPointerUp={() => setTimeout(endDrag)}
          onScroll={(ev) => setScrollX(ev.currentTarget.scrollLeft)}
        >
          <svg
            aria-label="Linha do tempo da carreira"
            height={H}
            role="img"
            style={{ width: W }}
            viewBox={`0 0 ${W} ${H}`}
          >
            {ticks.map((t) => (
              <g key={t}>
                <line className="pano-grid faint" x1={sx(t)} x2={sx(t)} y1={AXIS - 6} y2={H} />
                {/* O ano que encostaria no "hoje" fica sem rótulo. */}
                {Math.abs(sx(t) + 16 - today) > 34 && (
                  <text className="pano-axis-label" x={sx(t) + 3} y={AXIS - 10}>
                    {t}
                  </text>
                )}
              </g>
            ))}
            {layout.map((b) => (
              <line
                key={b.lane}
                className="pano-grid"
                x1="0"
                x2={W}
                y1={b.top - 4}
                y2={b.top - 4}
              />
            ))}
            <line className="pano-today" x1={today} x2={today} y1={AXIS - 6} y2={H} />
            <text className="pano-today-label" textAnchor="middle" x={today} y={AXIS - 10}>
              hoje
            </text>
            {layout.map((b) =>
              b.geo.map((g, i) => (
                <Entry
                  key={`${g.e.label}-${g.e.start}`}
                  g={g}
                  scrollX={scrollX}
                  y={b.top + b.rows[i]! * ROW}
                />
              )),
            )}
          </svg>
        </div>
      </div>
      <p className="pano-note">
        Arraste para os lados; ⌘ ou Ctrl com a roda do mouse (ou a pinça do trackpad) aproxima.
      </p>
    </>
  );
}

function Entry({ g, scrollX, y }: { g: Geo; scrollX: number; y: number }) {
  const { e } = g;
  // Dentro da barra, o rótulo fica no começo da parte visível, sem sair dela.
  const insideX = Math.min(Math.max(g.x0, scrollX) + 7, g.x1 - e.label.length * CHAR - 7);
  const when = e.point ? `${e.start}` : `${e.start}–${e.end ?? 'atual'}`;
  return (
    <Mark
      label={`${e.label}, ${when}`}
      selection={{ items: [e.item], label: e.label }}
      tip={
        <>
          <b>{e.label}</b>
          <br />
          {when}
        </>
      }
    >
      {e.point ? (
        <path className="pano-diamond" d={`M${g.x0 + 6},${y + 3} l6,6 l-6,6 l-6,-6z`} />
      ) : (
        <rect
          className={e.end ? 'pano-span done' : 'pano-span open'}
          height="16"
          width={g.x1 - g.x0 - 2}
          x={g.x0 + 1}
          y={y + 1}
        />
      )}
      <text
        className={g.place === 'dentro' && e.end ? 'pano-span-label on-fill' : 'pano-span-label'}
        textAnchor={g.place === 'esquerda' ? 'end' : 'start'}
        x={g.place === 'dentro' ? insideX : g.place === 'direita' ? g.x1 + 6 : g.x0 - 6}
        y={y + 13}
      >
        {e.label}
      </text>
    </Mark>
  );
}
