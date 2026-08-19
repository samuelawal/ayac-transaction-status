import { useMemo } from 'react';
import StatusPill from './StatusPill';
import VolumeChart from './VolumeChart';
import { MAX_SWEEP_PAGES, SWEEP_PAGE_SIZE } from '../lib/constants';
import { formatDay, formatMoney, formatMoneyWhole } from '../lib/format';
import { buildSeries } from '../lib/series';
import { summarise } from '../lib/summary';

const CEILING = MAX_SWEEP_PAGES * SWEEP_PAGE_SIZE;

function percent(value) {
  const pct = value * 100;
  if (pct > 0 && pct < 1) return '<1%';
  return `${pct.toFixed(pct < 10 ? 1 : 0)}%`;
}

/** Label, value, and a line of context. The number is the chart. */
function Tile({ label, value, note, tone }) {
  return (
    <div className="tile">
      <span className="tile-label">
        {tone && <i className={`dot ${tone}`} aria-hidden="true" />}
        {label}
      </span>
      <span className="tile-value">{value}</span>
      {note && <span className="tile-note">{note}</span>}
    </div>
  );
}

/**
 * A single bar showing how the whole set split four ways, with the legend
 * carrying the labels and counts — colour never has to be read on its own.
 * Empty groups keep their legend entry (a real zero is worth seeing) but leave
 * no segment behind in the bar.
 */
function Composition({ groups, total }) {
  const present = groups.filter((group) => group.count > 0);

  return (
    <>
      <div className="composition" role="img" aria-label={`Outcome split of ${total} transactions`}>
        {present.map((group) => (
          <span
            key={group.key}
            className={`seg ${group.tone}`}
            style={{ flexGrow: group.count }}
            title={`${group.label}: ${group.count.toLocaleString()} (${percent(group.share)})`}
          />
        ))}
      </div>
      <ul className="legend">
        {groups.map((group) => (
          <li key={group.key}>
            <i className={`dot ${group.tone}`} aria-hidden="true" />
            <span className="legend-label">{group.label}</span>
            <strong>{group.count.toLocaleString()}</strong>
            <span className="legend-share">{percent(group.share)}</span>
          </li>
        ))}
      </ul>
    </>
  );
}

/**
 * The table view of the same split — every value readable without hovering.
 * The bar's job is magnitude, so it stays one hue for every row; the pill beside
 * it is what carries which status this is.
 */
function ShareCell({ share }) {
  return (
    <td className="share">
      <span className="track">
        <span className="fill" style={{ width: `${Math.max(share * 100, 0.8)}%` }} />
      </span>
      <span className="pct">{percent(share)}</span>
    </td>
  );
}

export default function OverviewCard({
  status,
  error,
  rows,
  fetched,
  total,
  truncated,
  localStatus,
  onRefresh,
}) {
  const summary = useMemo(() => summarise(rows), [rows]);
  const series = useMemo(() => buildSeries(rows), [rows]);
  const busy = status === 'loading';
  const hasData = rows.length > 0;

  // Refetching holds the previous render at reduced opacity rather than
  // collapsing to a spinner, so nothing jumps under the cursor.
  const firstRun = busy && !hasData;

  return (
    <section className="panel overview" aria-live="polite">
      <header className="results-head">
        <h2>Overview</h2>
        {(hasData || busy) && (
          <div className="results-meta">
            {busy ? (
              <span>
                Reading… <strong>{fetched.toLocaleString()}</strong>
                {total > 0 && ` of ${total.toLocaleString()}`}
              </span>
            ) : (
              <>
                <span>
                  <strong>{summary.total.toLocaleString()}</strong> transactions
                </span>
                {summary.range.from && (
                  <>
                    <span className="sep" aria-hidden="true" />
                    <span>
                      {formatDay(summary.range.from)} – {formatDay(summary.range.to)}
                    </span>
                  </>
                )}
              </>
            )}
            <button type="button" className="btn quiet" disabled={busy} onClick={onRefresh}>
              Refresh
            </button>
          </div>
        )}
      </header>

      {localStatus && hasData && (
        <p className="caveat">
          The status filter is set aside here — an overview narrowed to one status has
          nothing left to break down. These figures cover every status in range.
        </p>
      )}

      {truncated && (
        <p className="caveat">
          Stopped at <strong>{CEILING.toLocaleString()}</strong> transactions, the most this
          sweep reads in one go. {total.toLocaleString()} match the filters, so these figures
          cover the newest {fetched.toLocaleString()} of them. Narrow the date range for a
          complete picture.
        </p>
      )}

      {firstRun && <p className="state">Reading every page…</p>}

      {status === 'error' && (
        <p className="state bad">
          {error}
          <button type="button" className="btn quiet" onClick={onRefresh}>
            Try again
          </button>
        </p>
      )}

      {status === 'ready' && !hasData && (
        <p className="state">Nothing matched those filters, so there is nothing to total up.</p>
      )}

      {hasData && (
        <div className={`overview-body${busy ? ' stale' : ''}`}>
          <div className="hero">
            <span className="hero-label">Collected</span>
            <span className="hero-figure">
              {formatMoneyWhole(summary.money.collected, summary.currency)}
            </span>
            <span className="hero-note">
              {summary.counts.settled.toLocaleString()} settled payment
              {summary.counts.settled === 1 ? '' : 's'} from{' '}
              {summary.customers.paid.toLocaleString()} of{' '}
              {summary.customers.total.toLocaleString()} people
              {summary.mixedCurrency && ` · mixed currencies, shown as ${summary.currency}`}
            </span>
          </div>

          <div className="tiles">
            <Tile
              label="Customers"
              value={summary.customers.total.toLocaleString()}
              note={`${summary.customers.unpaid.toLocaleString()} have not paid · ${summary.customers.repeat.toLocaleString()} tried more than once`}
            />
            <Tile
              label="Settled"
              tone="ok"
              value={percent(summary.settlementRate)}
              note={`${summary.counts.settled.toLocaleString()} of ${summary.total.toLocaleString()} transactions · ${formatMoneyWhole(
                summary.money.averagePaid,
                summary.currency,
              )} average`}
            />
            <Tile
              label="Awaiting payment"
              tone="warn"
              value={summary.counts.awaiting.toLocaleString()}
              note={`${formatMoneyWhole(summary.money.outstanding, summary.currency)} still expected`}
            />
            <Tile
              label="Expired or abandoned"
              tone="idle"
              value={summary.counts.lapsed.toLocaleString()}
              note={`${formatMoneyWhole(summary.money.lapsed, summary.currency)} never came in`}
            />
            <Tile
              label="Failed or cancelled"
              tone="bad"
              value={summary.counts.failed.toLocaleString()}
              note={`${formatMoneyWhole(summary.money.failed, summary.currency)} attempted`}
            />
          </div>

          {series && (
            <section className="breakdown">
              <h3>Registrations over time</h3>
              <VolumeChart series={series} currency={summary.currency} />
            </section>
          )}

          <section className="breakdown">
            <h3>How every transaction ended</h3>
            <Composition groups={summary.groups} total={summary.total} />

            <div className="mini-wrap">
              <table className="mini">
                <thead>
                  <tr>
                    <th>Status</th>
                    <th className="num">Transactions</th>
                    <th>Share</th>
                    <th className="num">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.statuses.map((entry) => (
                    <tr key={entry.status}>
                      <td>
                        <StatusPill status={entry.status} />
                      </td>
                      <td className="num">{entry.count.toLocaleString()}</td>
                      <ShareCell share={entry.share} />
                      <td className="num dim">{formatMoney(entry.value, summary.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="breakdown">
            <h3>Payment methods</h3>
            <div className="mini-wrap">
              <table className="mini">
                <thead>
                  <tr>
                    <th>Method</th>
                    <th className="num">Transactions</th>
                    <th>Share</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.methods.map((entry) => (
                    <tr key={entry.method}>
                      <td>{entry.method}</td>
                      <td className="num">{entry.count.toLocaleString()}</td>
                      <ShareCell share={entry.share} />
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <p className="footnote">
            Counted from all {summary.total.toLocaleString()} transactions matching the filters
            above — not just the page shown under Transactions. Monnify has no totals endpoint,
            so the overview reads the rows and adds them up.
          </p>
        </div>
      )}
    </section>
  );
}
