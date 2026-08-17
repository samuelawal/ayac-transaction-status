export default function AppHeader({ env }) {
  return (
    <header className="masthead">
      <div className="masthead-inner">
        <div className="identity">
          {/* Official emblem. Overwrite public/logo.png to swap it — 300x331 here,
              so the width below keeps its aspect ratio at a 34px cap. */}
          <img className="crest" src="/logo.png" alt="Living Faith Church" width="31" height="34" />
          <div>
            <span className="org">Living Faith Church</span>
            <span className="app-name">AYAC Registration transaction status</span>
          </div>
        </div>

        {env && (
          // Anything that is not sandbox — live, or a custom BASE_URL — is called
          // out in red, so real money is never mistaken for test data.
          <span className={`env${env === 'sandbox' ? '' : ' hot'}`}>
            <i className="dot" aria-hidden="true" />
            {env}
          </span>
        )}
      </div>
    </header>
  );
}
