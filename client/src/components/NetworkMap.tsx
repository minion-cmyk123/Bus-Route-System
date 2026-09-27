import { useState } from 'react';
import { Plus, Minus, LocateFixed, ArrowUpRight } from 'lucide-react';
import type { Network } from '../../../shared/types';
const positions: Record<string, [number, number]> = {
  saddar: [180, 355],
  liaquat: [222, 323],
  committee: [258, 290],
  faizabad: [326, 263],
  i8: [370, 226],
  pims: [412, 161],
  centaurus: [456, 136],
  secretariat: [577, 85],
  f6: [511, 73],
  g9: [302, 155],
  nust: [191, 193],
  airport: [74, 243],
};
export function NetworkMap({
  network,
  onStop,
}: {
  network: Network;
  onStop: (id: string) => void;
}) {
  const [zoom, setZoom] = useState(1);
  const [active, setActive] = useState<string | null>(null);
  const routes = network.routes.filter((r) => !r.id.endsWith('-return'));
  const mapped = routes.filter((r) => r.stops.every((s) => positions[s.id]));
  return (
    <section className="network-map" aria-label="Illustrative transit network map">
      <div className="map-heading">
        <span className="glass-label">
          <span className="green-dot" />
          Your city, connected
        </span>
        <span className="map-caption">SCHEMATIC NETWORK</span>
      </div>
      <svg
        className="map-svg"
        viewBox="0 0 650 430"
        role="group"
        aria-label="Schematic bus routes between Islamabad and Rawalpindi. Use the route legend to highlight a line."
      >
        <defs>
          <pattern
            id="blocks"
            width="58"
            height="44"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(-28)"
          >
            <rect
              x="5"
              y="5"
              width="45"
              height="31"
              rx="5"
              fill="#e5eade"
              stroke="#f6f8f1"
              strokeWidth="5"
            />
          </pattern>
          <filter id="shadow">
            <feDropShadow dx="0" dy="3" stdDeviation="4" floodOpacity=".12" />
          </filter>
        </defs>
        <rect width="650" height="430" fill="#eef1e8" />
        <rect width="650" height="430" fill="url(#blocks)" opacity=".7" />
        <path d="M360 -20 Q340 75 425 95T670 52V-20Z" fill="#d4e1c9" />
        <path d="M-30 115Q90 46 131 86T283 12L270-20H-30Z" fill="#dce7d1" />
        <path d="M540 470Q450 323 576 265T694 160" fill="none" stroke="#d0e1dc" strokeWidth="27" />
        <g fill="none" stroke="#fbfcf7" strokeWidth="12">
          <path d="M-20 285L652 29" />
          <path d="M138 450L547-20" />
          <path d="M-20 178L582 438" />
          <path d="M85-20L561 449" />
        </g>
        <text x="458" y="39" className="map-landmark">
          MARGALLA HILLS
        </text>
        <text x="483" y="216" className="map-city">
          ISLAMABAD
        </text>
        <text x="90" y="397" className="map-city">
          RAWALPINDI
        </text>
        <text x="42" y="139" className="map-landmark">
          H-12
        </text>
        <g transform={`translate(${325 * (1 - zoom)} ${215 * (1 - zoom)}) scale(${zoom})`}>
          {mapped.map((r) => (
            <polyline
              key={r.id}
              points={r.stops.map((s) => positions[s.id].join(',')).join(' ')}
              fill="none"
              stroke={r.color}
              strokeWidth={active === r.id ? 7 : 5}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={active && active !== r.id ? 0.16 : 0.86}
            />
          ))}
          {network.stops
            .filter((s) => positions[s.id])
            .map((s) => {
              const [x, y] = positions[s.id];
              return (
                <g
                  key={s.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`Use ${s.name} as your starting stop`}
                  onClick={() => onStop(s.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onStop(s.id);
                    }
                  }}
                  className="map-stop"
                >
                  <circle cx={x} cy={y} r="7" fill="#fcfdf9" stroke="#50695b" strokeWidth="2" />
                  <text x={x + 12} y={y + 4} className="stop-label">
                    {s.name}
                  </text>
                </g>
              );
            })}
          <g transform="translate(341 239)" filter="url(#shadow)">
            <rect width="29" height="29" rx="9" fill="#254f40" />
            <path
              d="M9 9h11v11H9zm0 5h11M11 7h7M11 22v-2m7 2v-2"
              fill="none"
              stroke="#ecf3cf"
              strokeWidth="1.5"
            />
          </g>
        </g>
      </svg>
      <div className="map-controls">
        <button
          aria-label="Zoom in"
          onClick={() => setZoom((z) => Math.min(1.5, z + 0.15))}
          disabled={zoom >= 1.5}
        >
          <Plus size={17} />
        </button>
        <button
          aria-label="Zoom out"
          onClick={() => setZoom((z) => Math.max(0.85, z - 0.15))}
          disabled={zoom <= 0.85}
        >
          <Minus size={17} />
        </button>
        <button
          aria-label="Reset map view"
          onClick={() => {
            setZoom(1);
            setActive(null);
          }}
        >
          <LocateFixed size={17} />
        </button>
      </div>
      <div className="map-bottom">
        <div className="map-legend">
          {mapped.map((r) => (
            <button
              key={r.id}
              onClick={() => setActive(active === r.id ? null : r.id)}
              aria-pressed={active === r.id}
            >
              <i style={{ background: r.color }} />
              {r.code}
            </button>
          ))}
        </div>
        <span>
          Illustrative map <ArrowUpRight size={12} />
        </span>
      </div>
    </section>
  );
}
