import { useCallback, useRef, useState } from 'react';
import { searchTransactions } from '../api/monnify';
import { MAX_SWEEP_PAGES, SWEEP_PAGE_SIZE } from '../lib/constants';
import { describeError } from '../lib/format';

/**
 * Fetches every transaction matching the current filters, so the overview counts
 * the whole set rather than one page of it.
 *
 * There is no aggregate endpoint on the v1 API, so totals have to be tallied from
 * the rows themselves — which means actually reading all of them. The sweep pages
 * through sequentially, reporting progress as it goes, and stops at
 * MAX_SWEEP_PAGES so an enormous merchant can never turn one click into an
 * unbounded run of requests. Hitting that ceiling is reported, never hidden.
 */

const INITIAL = {
  status: 'idle', // idle | loading | ready | error
  rows: [],
  total: 0, // totalElements as reported upstream
  fetched: 0, // how many rows are actually in hand
  truncated: false, // stopped at the ceiling with rows still unread
  error: null,
};

/**
 * `paymentStatus` is dropped on the way out. Upstream ignores it anyway, and an
 * overview narrowed to one status would have nothing left to break down — the
 * point of the view is the split across all of them.
 */
function sweepQuery(query) {
  const { paymentStatus, ...rest } = query ?? {};
  return rest;
}

/** Stable identity for a set of filters, so the same sweep is not run twice. */
function keyOf(query) {
  const entries = Object.entries(sweepQuery(query)).sort(([a], [b]) => a.localeCompare(b));
  return JSON.stringify(entries);
}

export function useOverview() {
  const [state, setState] = useState(INITIAL);

  // Guards against a superseded sweep writing over a newer one.
  const requestId = useRef(0);
  const lastKey = useRef(null);

  const run = useCallback(async (query) => {
    const id = (requestId.current += 1);
    const params = sweepQuery(query);

    setState({ ...INITIAL, status: 'loading' });

    try {
      const rows = [];
      let total = 0;
      let complete = false;

      for (let page = 0; page < MAX_SWEEP_PAGES; page += 1) {
        const result = await searchTransactions({
          ...params,
          page: String(page),
          size: String(SWEEP_PAGE_SIZE),
        });
        if (id !== requestId.current) return;

        const content = result?.content ?? [];
        rows.push(...content);
        total = result?.totalElements ?? rows.length;

        // A sweep is several requests; show the count climbing rather than a
        // spinner that sits still for half a minute.
        setState((prev) => ({ ...prev, fetched: rows.length, total }));

        if (result?.last || content.length === 0) {
          complete = true;
          break;
        }
      }

      if (id !== requestId.current) return;
      setState({
        status: 'ready',
        rows,
        total,
        fetched: rows.length,
        truncated: !complete && rows.length < total,
        error: null,
      });
    } catch (error) {
      if (id !== requestId.current) return;
      setState({ ...INITIAL, status: 'error', error: describeError(error) });
    }
  }, []);

  return {
    ...state,
    /** Sweep once per set of filters; a repeat visit reuses what is already held. */
    ensure: useCallback(
      (query) => {
        const key = keyOf(query);
        if (lastKey.current === key) return;
        lastKey.current = key;
        run(query);
      },
      [run],
    ),
    /** Re-read the same filters from scratch. */
    refresh: useCallback(
      (query) => {
        lastKey.current = keyOf(query);
        run(query);
      },
      [run],
    ),
  };
}
