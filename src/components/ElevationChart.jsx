import { computeElevationStats } from '../services/elevationProfile';

/**
 * @file Elevation profile card for a planned route: a small SVG area chart of
 * elevations plus ascent/descent/min/max stats. Handles loading and error
 * states and renders nothing when there is too little data.
 */

/**
 * Inline SVG area chart of the elevation samples, with min/mid/max y-axis labels.
 * @param {{ elevations: number[] }} props - Elevations in metres, in route order.
 * @returns {import('react').ReactElement}
 */
function ElevationSvgChart({ elevations }) {
  const W = 300,
    H = 108;
  const padL = 36,
    padR = 6,
    padT = 6,
    padB = 14;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;

  const min = Math.min(...elevations);
  const max = Math.max(...elevations);
  const range = max - min || 1;
  const n = elevations.length;

  const toX = (i) => padL + (i / (n - 1)) * chartW;
  const toY = (el) => padT + ((max - el) / range) * chartH;

  const pts = elevations.map((el, i) => [toX(i), toY(el)]);
  const linePoints = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');

  const bottomY = padT + chartH;
  const areaD = [
    `M ${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`,
    ...pts.slice(1).map(([x, y]) => `L ${x.toFixed(1)},${y.toFixed(1)}`),
    `L ${pts[n - 1][0].toFixed(1)},${bottomY.toFixed(1)}`,
    `L ${pts[0][0].toFixed(1)},${bottomY.toFixed(1)}`,
    'Z',
  ].join(' ');

  const midEl = Math.round((min + max) / 2);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      style={{ width: '100%', height: '100%', display: 'block' }}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="elev-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#007aff" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#007aff" stopOpacity="0.04" />
        </linearGradient>
      </defs>
      <line x1={padL} y1={padT} x2={padL + chartW} y2={padT} stroke="#ebebeb" strokeWidth="1" />
      <line
        x1={padL}
        y1={padT + chartH / 2}
        x2={padL + chartW}
        y2={padT + chartH / 2}
        stroke="#ebebeb"
        strokeWidth="1"
      />
      <line
        x1={padL}
        y1={bottomY}
        x2={padL + chartW}
        y2={bottomY}
        stroke="#d8d8d8"
        strokeWidth="1"
      />
      <path d={areaD} fill="url(#elev-fill)" />
      <polyline
        points={linePoints}
        fill="none"
        stroke="#007aff"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <text
        x={padL - 4}
        y={padT + 1}
        textAnchor="end"
        fontSize="9"
        fill="#aaa"
        dominantBaseline="hanging"
      >
        {max}m
      </text>
      <text
        x={padL - 4}
        y={padT + chartH / 2}
        textAnchor="end"
        fontSize="9"
        fill="#aaa"
        dominantBaseline="middle"
      >
        {midEl}m
      </text>
      <text
        x={padL - 4}
        y={bottomY}
        textAnchor="end"
        fontSize="9"
        fill="#aaa"
        dominantBaseline="auto"
      >
        {min}m
      </text>
    </svg>
  );
}

/**
 * @typedef {Object} ElevationChartProps
 * @property {number[]} elevations - Elevation samples in metres, in route order.
 * @property {boolean} loading - When true, shows a loading message.
 * @property {boolean} error - When true, shows an "unavailable" message.
 */

/**
 * Elevation profile card. Shows a loading or error state, and otherwise renders
 * the SVG chart with ascent/descent/low/high stats.
 * @param {ElevationChartProps} props
 * @returns {import('react').ReactElement | null} Null when not loading/error and
 *   fewer than two elevation samples are available.
 */
export default function ElevationChart({ elevations, loading, error }) {
  if (loading) {
    return (
      <div className="elevation-chart">
        <div className="elevation-chart__label">Elevation Profile</div>
        <div className="elevation-chart__status">Loading elevation profile…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="elevation-chart">
        <div className="elevation-chart__label">Elevation Profile</div>
        <div className="elevation-chart__status elevation-chart__status--error">
          Elevation data unavailable
        </div>
      </div>
    );
  }

  if (!elevations || elevations.length < 2) return null;

  const { ascent, descent, minElevation, maxElevation } = computeElevationStats(elevations);

  return (
    <div className="elevation-chart">
      <div className="elevation-chart__label">Elevation Profile</div>
      <div className="elevation-chart__svg-wrap">
        <ElevationSvgChart elevations={elevations} />
      </div>
      <div className="elevation-chart__stats">
        <div className="elevation-chart__stat">
          <span className="elevation-chart__stat-arrow elevation-chart__stat-arrow--up">↑</span>
          <span className="elevation-chart__stat-value">{ascent} m</span>
          <span className="elevation-chart__stat-desc">Ascent</span>
        </div>
        <div className="elevation-chart__stat">
          <span className="elevation-chart__stat-arrow elevation-chart__stat-arrow--down">↓</span>
          <span className="elevation-chart__stat-value">{descent} m</span>
          <span className="elevation-chart__stat-desc">Descent</span>
        </div>
        <div className="elevation-chart__stat">
          <span className="elevation-chart__stat-value">{minElevation} m</span>
          <span className="elevation-chart__stat-desc">Low</span>
        </div>
        <div className="elevation-chart__stat">
          <span className="elevation-chart__stat-value">{maxElevation} m</span>
          <span className="elevation-chart__stat-desc">High</span>
        </div>
      </div>
    </div>
  );
}
