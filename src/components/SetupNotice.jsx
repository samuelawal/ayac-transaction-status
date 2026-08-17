import AppHeader from './AppHeader';

/**
 * Shown when the server cannot authenticate — almost always a missing or wrong
 * .env. Spells out the fix rather than surfacing a bare 503.
 */
export default function SetupNotice({ env, error, onRetry, checking }) {
  return (
    <div className="app">
      <AppHeader env={env} />
      <main className="page narrow">
        <section className="panel setup">
          <h2>Not signed in to Monnify</h2>
          <p className="notice notice-bad">{error || 'The credential check did not succeed.'}</p>

          <ol>
            <li>
              Copy the template — <code>cp .env.example .env</code>
            </li>
            <li>
              Fill in <code>MONNIFY_API_KEY</code> and <code>MONNIFY_SECRET_KEY</code> for the{' '}
              <strong>{env ?? 'target'}</strong> environment.
            </li>
            <li>
              Set <code>MONNIFY_ENV</code> to <code>sandbox</code> or <code>live</code> — keys are not
              interchangeable between the two.
            </li>
            <li>Restart the server, then re-check.</li>
          </ol>

          <button type="button" className="btn solid" onClick={onRetry} disabled={checking}>
            {checking ? 'Checking…' : 'Re-check'}
          </button>
        </section>
      </main>
    </div>
  );
}
