import { useCallback, useEffect, useState } from 'react';
import { fetchSession } from '../api/monnify';

/**
 * Checks once at startup that the server has working Monnify credentials, so a
 * missing .env shows as a setup screen rather than a failed first search.
 */
export function useServerSession() {
  const [state, setState] = useState({ status: 'checking', env: null, error: null });

  const check = useCallback(async () => {
    setState((prev) => ({ ...prev, status: 'checking', error: null }));
    const session = await fetchSession();
    setState({
      status: session.ready ? 'ready' : 'unconfigured',
      env: session.env ?? null,
      baseUrl: session.baseUrl ?? null,
      error: session.error ?? null,
    });
  }, []);

  useEffect(() => {
    check();
  }, [check]);

  return { ...state, recheck: check };
}
