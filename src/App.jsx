import { useCallback, useEffect, useState } from 'react';
import AppHeader from './components/AppHeader';
import FilterBar from './components/FilterBar';
import ResultsCard from './components/ResultsCard';
import SetupNotice from './components/SetupNotice';
import TransactionDrawer from './components/TransactionDrawer';
import { useServerSession } from './hooks/useServerSession';
import { useToast } from './hooks/useToast';
import { useTransactionSearch } from './hooks/useTransactionSearch';
import { previewRequest } from './lib/params';
import { narrowByStatus } from './lib/rows';

export default function App() {
  const session = useServerSession();
  const search = useTransactionSearch();
  const { message: toast, show: showToast } = useToast();
  const [selectedIndex, setSelectedIndex] = useState(null);

  // `paymentStatus` is accepted but ignored upstream, so it is applied here over the
  // rows the server returned. Everything downstream works off `rows`.
  const loaded = search.result?.content ?? [];
  const localStatus = search.query?.paymentStatus ?? null;
  const rows = narrowByStatus(loaded, localStatus);

  // Each new response clears the selection; a lookup that lands on exactly one row
  // opens its detail immediately, which is the common case for a reference search.
  useEffect(() => {
    if (search.status === 'ready' && rows.length === 1) setSelectedIndex(0);
    else setSelectedIndex(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search.status, search.result, localStatus]);

  const copy = useCallback(
    async (text) => {
      try {
        await navigator.clipboard.writeText(text);
        showToast('Copied');
      } catch {
        showToast('Could not copy to clipboard');
      }
    },
    [showToast],
  );

  if (session.status === 'checking') {
    return (
      <div className="app">
        <AppHeader env={session.env} />
        <main className="page narrow">
          <p className="state">Connecting to Monnify…</p>
        </main>
      </div>
    );
  }

  if (session.status === 'unconfigured') {
    return <SetupNotice env={session.env} error={session.error} onRetry={session.recheck} />;
  }

  const selected = selectedIndex === null ? null : rows[selectedIndex] ?? null;

  return (
    <div className="app">
      <AppHeader env={session.env} />

      <main className="page">
        <FilterBar
          size={search.size}
          onSizeChange={search.changeSize}
          onSearch={search.search}
          onReset={search.reset}
          busy={search.status === 'loading'}
          preview={previewRequest(search.query, search.page, search.size)}
        />

        <ResultsCard
          status={search.status}
          error={search.error}
          result={search.result}
          rows={rows}
          loadedCount={loaded.length}
          localStatus={localStatus}
          page={search.page}
          selectedIndex={selectedIndex}
          onSelect={setSelectedIndex}
          onPage={search.goToPage}
        />
      </main>

      {selected && (
        <TransactionDrawer transaction={selected} onClose={() => setSelectedIndex(null)} onCopy={copy} />
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
