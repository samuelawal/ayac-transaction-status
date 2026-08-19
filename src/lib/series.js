/**
 * Buckets transactions into a contiguous time series for the overview chart.
 *
 * Contiguous matters: a quiet week has to show up as a dip, not vanish and pull
 * the next week's point leftward. Buckets are emitted for every period between
 * the first and last transaction, empty ones included.
 */

const DAY = 86_400_000;

/**
 * Widen the bucket until the series is a readable number of points. The ceilings
 * are deliberately low — a two-year range plotted weekly is 110 points crammed
 * into a strip, where the same range by month is 26 and actually legible.
 */
const UNITS = [
  { unit: 'day', maxBuckets: 62 },
  { unit: 'week', maxBuckets: 60 },
  { unit: 'month', maxBuckets: Infinity },
];

function startOf(value, unit) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  if (unit === 'month') date.setDate(1);
  if (unit === 'week') {
    // Weeks start on Monday; getDay() is Sunday-first, so rotate it.
    date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  }
  return date;
}

function advance(date, unit) {
  const next = new Date(date);
  if (unit === 'day') next.setDate(next.getDate() + 1);
  else if (unit === 'week') next.setDate(next.getDate() + 7);
  else next.setMonth(next.getMonth() + 1);
  return next;
}

/** Roughly how many buckets a span would need, used only to pick the unit. */
function estimate(span, unit) {
  if (unit === 'day') return span / DAY + 1;
  if (unit === 'week') return span / (7 * DAY) + 1;
  return span / (30 * DAY) + 1;
}

/**
 * Day and week labels drop the year to stay short, but only when every bucket
 * shares one — "Jul 15" beside "Aug 17" is a guess if the range spans 2024–2026.
 */
function labelFor(date, unit, withYear) {
  if (unit === 'month') {
    return date.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
  }
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: '2-digit',
    ...(withYear ? { year: '2-digit' } : {}),
  });
}

const SETTLED = new Set(['PAID', 'OVERPAID']);

/**
 * Returns { unit, buckets: [{ start, label, total, settled, collected }] }, or
 * null when no row carries a usable date.
 */
export function buildSeries(rows) {
  const dated = [];
  let earliest = Infinity;
  let latest = -Infinity;

  for (const row of rows) {
    const created = Date.parse(row.createdOn);
    if (!Number.isFinite(created)) continue;
    dated.push({ created, row });
    if (created < earliest) earliest = created;
    if (created > latest) latest = created;
  }

  if (dated.length === 0) return null;

  const span = latest - earliest;
  const { unit } = UNITS.find((candidate) => estimate(span, candidate.unit) <= candidate.maxBuckets)
    ?? UNITS[UNITS.length - 1];

  const buckets = [];
  const indexOf = new Map();
  const end = startOf(latest, unit).getTime();
  const withYear = new Date(earliest).getFullYear() !== new Date(latest).getFullYear();

  for (let cursor = startOf(earliest, unit); cursor.getTime() <= end; cursor = advance(cursor, unit)) {
    indexOf.set(cursor.getTime(), buckets.length);
    buckets.push({
      start: cursor.getTime(),
      label: labelFor(cursor, unit, withYear),
      total: 0,
      settled: 0,
      collected: 0,
    });
  }

  for (const { created, row } of dated) {
    const bucket = buckets[indexOf.get(startOf(created, unit).getTime())];
    if (!bucket) continue;
    bucket.total += 1;
    if (SETTLED.has(row.paymentStatus)) {
      bucket.settled += 1;
      const amount = Number(row.amount);
      if (Number.isFinite(amount)) bucket.collected += amount;
    }
  }

  return { unit, buckets };
}

/**
 * A tick step that lands on round numbers, and the axis maximum it implies.
 * The axis counts transactions, so the step never drops below 1 — a gridline at
 * 0.5 of a registration is not a number anyone needs.
 */
export function niceScale(peak, divisions = 4) {
  if (!(peak > 0)) return { max: divisions, step: 1 };
  const raw = peak / divisions;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step =
    [1, 2, 5, 10].map((factor) => factor * magnitude).find((value) => value >= raw)
    ?? 10 * magnitude;
  const whole = Math.max(1, Math.round(step));
  return { max: whole * divisions, step: whole };
}
