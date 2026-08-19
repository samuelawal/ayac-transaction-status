import { useCallback, useRef, useState } from 'react';
import { searchTransactions } from '../api/monnify';
import { DEFAULT_PAGE_SIZE } from '../lib/constants';
import { describeError } from '../lib/format';

const INITIAL = {
  status: 'idle', // idle | loading | ready | error
  query: null, // last submitted params, without page/size
  page: 0,
  size: DEFAULT_PAGE_SIZE,
  result: null, // Spring page object from responseBody
  error: null,
};

/** Owns the v1 search: current query, paging, and the response. */
export function useTransactionSearch() {
  const [state, setState] = useState(INITIAL);

  // Guards against an older, slower response overwriting a newer one.
  const requestId = useRef(0);

  const reset = useCallback(() => {
    requestId.current += 1;
    setState((prev) => ({ ...INITIAL, size: prev.size }));
  }, []);

  const execute = useCallback(async ({ query, page, size }) => {
    const id = (requestId.current += 1);
    setState((prev) => ({ ...prev, query, page, size, status: 'loading', error: null }));

    try {
      const result = await searchTransactions({ ...query, page: String(page), size: String(size) });
      if (id !== requestId.current) return;
      setState((prev) => ({ ...prev, status: 'ready', result, error: null }));
    } catch (error) {
      if (id !== requestId.current) return;
      setState((prev) => ({ ...prev, status: 'error', result: null, error: describeError(error) }));
    }
  }, []);

  return {
    ...state,
    // Size travels with the search, so the form applies filters and page size in
    // one go; paging afterwards reuses whatever size that search ran with.
    search: (query, size = state.size) => execute({ query, page: 0, size }),
    goToPage: (page) => execute({ query: state.query, page, size: state.size }),
    reset,
  };
}
