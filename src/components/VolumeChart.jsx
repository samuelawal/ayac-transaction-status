import { useEffect, useMemo, useRef, useState } from 'react';
import { formatDay, formatMoneyWhole } from '../lib/format';
import { niceScale } from '../lib/series';

/**
 * Registrations over time, with settled payments picked out against them.
 *
 * Two lines rather than four: the story is how much of the intake actually
 * converted, so settled carries the accent and the total sits behind it in the
 * de-emphasis grey. Every value on the chart is also in the table underneath, so
 * the hover layer only ever adds convenience.
 */

const HEIGHT = 232;
const PAD = { top: 16, right: 16, bottom: 26, left: 50 };
const DIVISIONS = 4;

const UNIT_NOUN = { day: 'day', week: 'week', month: 'month' };

/** Actual pixel width, so strokes stay 2px and labels stay 11px at any size. */
function useWidth() {
  const ref = useRef(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(node);
    setWidth(node.clientWidth);
    return () => observer.disconnect();
  }, []);

  return [ref, width];
}

export default function VolumeChart({ series, currency }) {
  const [wrapRef, width] = useWidth();
  const [active, setActive] = useState(null);

  const { unit, buckets } = series;
  const count = buckets.length;

  const scale = useMemo(
    () => niceScale(Math.max(...buckets.map((bucket) => bucket.total)), DIVISIONS),
    [buckets],
  );

  const plotW = Math.max(width - PAD.left - PAD.right, 10);
  const plotH = HEIGHT - PAD.top - PAD.bottom;

  const xOf = (index) =>
    PAD.left + (count < 2 ? plotW / 2 : (index / (count - 1)) * plotW);
  const yOf = (value) => PAD.top + plotH - (value / scale.max) * plotH;

  const pathFor = (key) =>
    buckets
      .map((bucket, index) => `${index ? 'L' : 'M'}${xOf(index).toFixed(1)} ${yOf(bucket[key]).toFixed(1)}`)
      .join(' ');

  // Enough room for a date label every ~110px, first and last always shown.
  const labelIndices = useMemo(() => {
    if (count < 2) return [0];
    const wanted = Math.max(2, Math.min(7, Math.floor(plotW / 110)));
    const picked = new Set();
    for (let i = 0; i < wanted; i += 1) {
      picked.add(Math.round((i * (count - 1)) / (wanted - 1)));
    }
    return [...picked].sort((a, b) => a - b);
  }, [count, plotW]);

  const last = count - 1;
  const endGap = Math.abs(yOf(buckets[last].total) - yOf(buckets[last].settled));
  // End labels only when the two lines have separated enough to stay attached to
  // the right line. When they converge, the legend and tooltip carry it instead.
  const showEndLabels = count > 1 && endGap >= 15;

  const pick = (event) => {
    if (count === 0) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientX - bounds.left - PAD.left) / plotW;
    setActive(Math.max(0, Math.min(count - 1, Math.round(ratio * (count - 1)))));
  };

  const onKeyDown = (event) => {
    const step = { ArrowLeft: -1, ArrowRight: 1 }[event.key];
    if (step) {
      event.preventDefault();
      setActive((prev) => {
        const next = (prev ?? (step > 0 ? -1 : count)) + step;
        return Math.max(0, Math.min(count - 1, next));
      });
    } else if (event.key === 'Home') {
      event.preventDefault();
      setActive(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      setActive(count - 1);
    } else if (event.key === 'Escape') {
      setActive(null);
    }
  };

  const hovered = active === null ? null : buckets[active];
  const ready = width > 0;

  return (
    <div className="chart" ref={wrapRef}>
      {ready && (
        <svg
          width={width}
          height={HEIGHT}
          tabIndex={0}
          role="img"
          aria-label={`Transactions per ${UNIT_NOUN[unit]}, with settled payments. ${count} points from ${buckets[0].label} to ${buckets[last].label}. Full figures in the table below.`}
          onPointerMove={pick}
          onPointerLeave={() => setActive(null)}
          onKeyDown={onKeyDown}
          onBlur={() => setActive(null)}
        >
          {/* Hairline grid, one step off the surface, solid — never dashed. */}
          {Array.from({ length: DIVISIONS + 1 }, (_, i) => {
            const value = i * scale.step;
            const y = yOf(value);
            return (
              <g key={value}>
                <line className="grid" x1={PAD.left} x2={PAD.left + plotW} y1={y} y2={y} />
                <text className="tick" x={PAD.left - 10} y={y + 3.5} textAnchor="end">
                  {value.toLocaleString()}
                </text>
              </g>
            );
          })}

          {labelIndices.map((index) => (
            <text
              key={index}
              className="tick"
              x={xOf(index)}
              y={HEIGHT - 8}
              textAnchor={index === 0 ? 'start' : index === last ? 'end' : 'middle'}
            >
              {buckets[index].label}
            </text>
          ))}

          {hovered && (
            <line
              className="crosshair"
              x1={xOf(active)}
              x2={xOf(active)}
              y1={PAD.top}
              y2={PAD.top + plotH}
            />
          )}

          {count < 2 ? (
            <>
              <circle className="point total" cx={xOf(0)} cy={yOf(buckets[0].total)} r={4} />
              <circle className="point settled" cx={xOf(0)} cy={yOf(buckets[0].settled)} r={4} />
            </>
          ) : (
            <>
              <path className="line total" d={pathFor('total')} />
              <path className="line settled" d={pathFor('settled')} />
            </>
          )}

          {showEndLabels && (
            <>
              <text className="end-label" x={xOf(last) - 6} y={yOf(buckets[last].total) - 8} textAnchor="end">
                {buckets[last].total.toLocaleString()}
              </text>
              <text
                className="end-label"
                x={xOf(last) - 6}
                y={yOf(buckets[last].settled) - 8}
                textAnchor="end"
              >
                {buckets[last].settled.toLocaleString()}
              </text>
            </>
          )}

          {hovered && (
            <>
              <circle className="point total" cx={xOf(active)} cy={yOf(hovered.total)} r={4} />
              <circle className="point settled" cx={xOf(active)} cy={yOf(hovered.settled)} r={4} />
            </>
          )}

          {/* Uniform hit area over the whole plot — the reader aims at a date,
              never at a 2px line. */}
          <rect x={PAD.left} y={PAD.top} width={plotW} height={plotH} fill="transparent" />
        </svg>
      )}

      {hovered && (
        <div
          className="chart-tip"
          style={{ left: Math.min(Math.max(xOf(active), 96), Math.max(width - 96, 96)) }}
        >
          <span className="tip-when">{formatDay(hovered.start)}</span>
          <span className="tip-row">
            <i className="key total" aria-hidden="true" />
            <strong>{hovered.total.toLocaleString()}</strong> registrations
          </span>
          <span className="tip-row">
            <i className="key settled" aria-hidden="true" />
            <strong>{hovered.settled.toLocaleString()}</strong> settled
          </span>
          <span className="tip-note">{formatMoneyWhole(hovered.collected, currency)} collected</span>
        </div>
      )}

      <ul className="legend">
        <li>
          <i className="key total" aria-hidden="true" />
          <span className="legend-label">All registrations</span>
        </li>
        <li>
          <i className="key settled" aria-hidden="true" />
          <span className="legend-label">Settled</span>
        </li>
        <li className="legend-note">
          one point per {UNIT_NOUN[unit]} · hover or use ← → for figures
        </li>
      </ul>

      <details className="table-twin">
        <summary>Table view</summary>
        <div className="mini-wrap">
          <table className="mini">
            <thead>
              <tr>
                <th>{unit === 'month' ? 'Month' : 'Starting'}</th>
                <th className="num">Registrations</th>
                <th className="num">Settled</th>
                <th className="num">Collected</th>
              </tr>
            </thead>
            <tbody>
              {buckets.map((bucket) => (
                <tr key={bucket.start}>
                  <td>{bucket.label}</td>
                  <td className="num">{bucket.total.toLocaleString()}</td>
                  <td className="num">{bucket.settled.toLocaleString()}</td>
                  <td className="num dim">{formatMoneyWhole(bucket.collected, currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
