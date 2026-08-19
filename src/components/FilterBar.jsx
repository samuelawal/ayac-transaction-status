import { useState } from 'react';
import {
  HEAVY_PAGE_SIZE,
  MIN_PAGE_SIZE,
  PAGE_SIZE_PRESETS,
  PAYMENT_STATUSES,
} from '../lib/constants';
import { buildSearchParams, countActiveFilters, EMPTY_FILTERS } from '../lib/params';
import { humanStatus } from '../lib/rows';

/**
 * Every v1 query parameter, all optional, all combinable — the same model as
 * ticking rows in Postman's Params tab. Leaving everything blank lists the
 * merchant's transactions newest first.
 *
 * Page size is part of the form rather than a live control, so typing "5000"
 * does not fire a request per keystroke. Everything applies on Search.
 */
export default function FilterBar({ initialSize, onSearch, onReset, busy, preview }) {
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [size, setSize] = useState(String(initialSize));
  const [error, setError] = useState(null);

  const set = (patch) => setFilters((prev) => ({ ...prev, ...patch }));
  const active = countActiveFilters(filters);
  const parsedSize = Number(size);
  const sizeIsHeavy = Number.isInteger(parsedSize) && parsedSize > HEAVY_PAGE_SIZE;

  function handleSubmit(event) {
    event.preventDefault();

    // Monnify rejects a size below 1 outright; catch it here with a clearer message.
    if (!/^\d+$/.test(size.trim()) || parsedSize < MIN_PAGE_SIZE) {
      setError(`Per page must be a whole number of ${MIN_PAGE_SIZE} or more.`);
      return;
    }

    try {
      const params = buildSearchParams(filters);
      setError(null);
      onSearch(params, parsedSize);
    } catch (err) {
      setError(err.message);
    }
  }

  function handleReset() {
    setFilters(EMPTY_FILTERS);
    setSize(String(initialSize));
    setError(null);
    onReset();
  }

  return (
    <form className="panel filters" onSubmit={handleSubmit}>
      <div className="grid">
        <label className="field field-wide">
          <span className="label">Payment reference</span>
          <input
            type="text"
            className="mono"
            value={filters.paymentReference}
            onChange={(event) => set({ paymentReference: event.target.value })}
            placeholder="1786960088791"
            spellCheck="false"
          />
        </label>

        <label className="field field-wide">
          <span className="label">
            Transaction reference
            <button
              type="button"
              className={`toggle${filters.useTxRef ? ' on' : ''}`}
              aria-pressed={filters.useTxRef}
              onClick={() => set({ useTxRef: !filters.useTxRef })}
              title="Adds useTxRef=true to the request"
            >
              useTxRef
            </button>
          </span>
          <input
            type="text"
            className="mono"
            value={filters.transactionReference}
            onChange={(event) => set({ transactionReference: event.target.value })}
            placeholder="MNFY|47|20260817104810|212190"
            spellCheck="false"
          />
        </label>

        <label className="field">
          <span className="label">Customer email</span>
          <input
            type="text"
            value={filters.customerEmail}
            onChange={(event) => set({ customerEmail: event.target.value })}
            placeholder="name@example.com"
            spellCheck="false"
          />
        </label>

        <label className="field">
          <span className="label">Customer name</span>
          <input
            type="text"
            value={filters.customerName}
            onChange={(event) => set({ customerName: event.target.value })}
            placeholder="Any name"
            spellCheck="false"
          />
        </label>

        <label className="field">
          <span className="label">Status</span>
          <select
            value={filters.paymentStatus}
            onChange={(event) => set({ paymentStatus: event.target.value })}
          >
            <option value="">Any status</option>
            {PAYMENT_STATUSES.map((status) => (
              <option key={status} value={status}>
                {humanStatus(status)}
              </option>
            ))}
          </select>
          {filters.paymentStatus && (
            // The upstream endpoint accepts this param and then ignores it, so say
            // plainly where the filtering actually happens.
            <span className="hint">Applied to the loaded page — see note in results</span>
          )}
        </label>

        <label className="field">
          <span className="label">From</span>
          <input
            type="datetime-local"
            value={filters.from}
            onChange={(event) => set({ from: event.target.value })}
          />
        </label>

        <label className="field">
          <span className="label">To</span>
          <input
            type="datetime-local"
            value={filters.to}
            onChange={(event) => set({ to: event.target.value })}
          />
        </label>

        <div className="field">
          <span className="label">Per page</span>
          <input
            type="number"
            inputMode="numeric"
            min={MIN_PAGE_SIZE}
            step="1"
            value={size}
            onChange={(event) => setSize(event.target.value)}
            aria-label="Results per page"
          />
          <span className="presets">
            {PAGE_SIZE_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                className={`preset${parsedSize === preset ? ' on' : ''}`}
                onClick={() => setSize(String(preset))}
              >
                {preset.toLocaleString()}
              </button>
            ))}
          </span>
          {sizeIsHeavy && (
            <span className="hint">
              {parsedSize.toLocaleString()} rows in one page — slower to fetch and render, but it
              makes the status filter cover the whole set.
            </span>
          )}
        </div>
      </div>

      {error && <p className="notice notice-bad">{error}</p>}

      <div className="filters-foot">
        <span className="applied">
          {active === 0
            ? 'No filters — lists everything, newest first'
            : `${active} filter${active > 1 ? 's' : ''} applied`}
        </span>
        <div className="actions">
          {active > 0 && (
            <button type="button" className="btn quiet" onClick={handleReset}>
              Clear
            </button>
          )}
          <button type="submit" className="btn solid" disabled={busy}>
            {busy ? 'Searching…' : 'Search'}
          </button>
        </div>
      </div>

      {preview && (
        <details className="request">
          <summary>Request</summary>
          <code>{preview}</code>
        </details>
      )}
    </form>
  );
}
