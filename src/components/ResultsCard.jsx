import StatusPill from './StatusPill';
import { UPSTREAM_SEARCH_PATH } from '../lib/constants';
import { formatMoney, formatShortDateTime } from '../lib/format';
import { humanStatus } from '../lib/rows';

const SETTLED = new Set(['PAID', 'OVERPAID']);
const AWAITING = new Set(['PENDING', 'PARTIALLY_PAID']);

/**
 * Column order runs from the identifying facts to the verdict: who paid, how much,
 * when, and how, then the long mono references, and finally the status — which is
 * the one column with a shape of its own, so it reads cleanly down the right edge
 * without needing to be scanned against anything.
 */
function Rows({ rows, selectedIndex, onSelect }) {
  return rows.map((row, index) => (
    <tr
      key={row.transactionReference ?? `${row.paymentReference}-${index}`}
      tabIndex={0}
      className={index === selectedIndex ? 'selected' : undefined}
      onClick={() => onSelect(index)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect(index);
        }
      }}
    >
      <td data-label="Customer" className="truncate" title={row.customerDTO?.email ?? ''}>
        {row.customerDTO?.email || row.customerDTO?.name || '—'}
      </td>
      <td data-label="Amount" className="num">
        {formatMoney(row.amount, row.currencyCode)}
      </td>
      <td data-label="Created" className="dim num">
        {formatShortDateTime(row.createdOn)}
      </td>
      <td data-label="Method" className="dim">
        {row.paymentMethod || '—'}
      </td>
      <td data-label="Payment ref" className="mono">
        {row.paymentReference || '—'}
      </td>
      <td data-label="Transaction ref" className="mono dim">
        {row.transactionReference || '—'}
      </td>
      <td data-label="Status">
        <StatusPill status={row.paymentStatus} />
      </td>
    </tr>
  ));
}

export default function ResultsCard({
  status,
  error,
  result,
  rows,
  loadedCount,
  localStatus,
  page,
  selectedIndex,
  onSelect,
  onPage,
}) {
  const hasRows = status === 'ready' && rows.length > 0;

  const pageNumber = result?.number ?? page;
  const pageSize = result?.size ?? loadedCount;
  const total = result?.totalElements ?? loadedCount;
  const totalPages = result?.totalPages ?? 1;
  const firstOnPage = pageNumber * pageSize + 1;
  const lastOnPage = firstOnPage + loadedCount - 1;

  const settled = rows.filter((row) => SETTLED.has(row.paymentStatus)).length;
  const awaiting = rows.filter((row) => AWAITING.has(row.paymentStatus)).length;

  return (
    <section className="panel results" aria-live="polite">
      <header className="results-head">
        <h2>Transactions</h2>
        {status === 'ready' && result && (
          <div className="results-meta">
            <span>
              <strong>{total.toLocaleString()}</strong> matching
            </span>
            <span className="sep" aria-hidden="true" />
            {localStatus ? (
              <span>
                <strong>{rows.length.toLocaleString()}</strong>{' '}
                {humanStatus(localStatus).toLowerCase()} of {loadedCount.toLocaleString()} loaded
              </span>
            ) : (
              <>
                <span>
                  showing {firstOnPage.toLocaleString()}–{lastOnPage.toLocaleString()}
                </span>
                {loadedCount > 0 && (
                  <>
                    <span className="sep" aria-hidden="true" />
                    <span className="tally">
                      <i className="dot ok" aria-hidden="true" />
                      {settled.toLocaleString()} settled
                      <i className="dot warn" aria-hidden="true" />
                      {awaiting.toLocaleString()} pending
                      <em>on this page</em>
                    </span>
                  </>
                )}
              </>
            )}
          </div>
        )}
      </header>

      {localStatus && status === 'ready' && result && (
        <p className="caveat">
          Monnify’s v1 search ignores <code>paymentStatus</code>, so this filter is applied to the{' '}
          {loadedCount.toLocaleString()} rows on this page only. Raise <strong>per page</strong> to
          widen the net.
        </p>
      )}

      {status === 'loading' && <p className="state">Searching…</p>}

      {status === 'error' && (
        <p className="state bad">
          {error}
          <code>{UPSTREAM_SEARCH_PATH}</code>
        </p>
      )}

      {(status === 'idle' || (status === 'ready' && !result)) && (
        <p className="state">Search to list transactions.</p>
      )}

      {status === 'ready' && result && rows.length === 0 && (
        <p className="state">
          {localStatus && loadedCount > 0
            ? `None of the ${loadedCount.toLocaleString()} rows on this page are ${humanStatus(
                localStatus,
              ).toLowerCase()}.`
            : 'Nothing matched those filters.'}
        </p>
      )}

      {hasRows && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Customer</th>
                <th className="num">Amount</th>
                <th className="num">Created</th>
                <th>Method</th>
                <th>Payment ref</th>
                <th>Transaction ref</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              <Rows rows={rows} selectedIndex={selectedIndex} onSelect={onSelect} />
            </tbody>
          </table>
        </div>
      )}

      {status === 'ready' && result && totalPages > 1 && (
        <nav className="pager">
          <button
            type="button"
            className="btn quiet"
            disabled={pageNumber === 0}
            onClick={() => onPage(pageNumber - 1)}
          >
            Previous
          </button>
          <span>
            Page {(pageNumber + 1).toLocaleString()} of {totalPages.toLocaleString()}
          </span>
          <button
            type="button"
            className="btn quiet"
            disabled={Boolean(result?.last)}
            onClick={() => onPage(pageNumber + 1)}
          >
            Next
          </button>
        </nav>
      )}
    </section>
  );
}
