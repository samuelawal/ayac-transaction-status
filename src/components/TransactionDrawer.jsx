import { useEffect } from 'react';
import StatusPill from './StatusPill';
import { formatBoolean, formatDateTime, formatMoney } from '../lib/format';

function Row({ label, value, mono = false, copy = false, onCopy }) {
  const text = value === null || value === undefined || value === '' ? '—' : String(value);
  return (
    <div className="row">
      <dt>{label}</dt>
      <dd className={mono ? 'mono' : undefined}>
        {text}
        {copy && text !== '—' && (
          <button type="button" className="copy" onClick={() => onCopy(text)}>
            Copy
          </button>
        )}
      </dd>
    </div>
  );
}

export default function TransactionDrawer({ transaction, onClose, onCopy }) {
  useEffect(() => {
    const handleKey = (event) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const currency = transaction.currencyCode;
  const metadata = Object.entries(transaction.metaData ?? {});

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <aside className="drawer" aria-label="Transaction detail">
        <header className="drawer-head">
          <div>
            <span className="drawer-amount">{formatMoney(transaction.amount, currency)}</span>
            <StatusPill status={transaction.paymentStatus} />
          </div>
          <button type="button" className="btn quiet" onClick={onClose}>
            Close
          </button>
        </header>

        <div className="drawer-body">
          <section className="group">
            <h3>References</h3>
            <dl>
              <Row label="Payment" value={transaction.paymentReference} mono copy onCopy={onCopy} />
              <Row label="Transaction" value={transaction.transactionReference} mono copy onCopy={onCopy} />
            </dl>
          </section>

          <section className="group">
            <h3>Payment</h3>
            <dl>
              <Row label="Description" value={transaction.paymentDescription} />
              <Row label="Method" value={transaction.paymentMethod} />
              <Row label="Channel" value={transaction.collectionChannel} />
              <Row label="Scope" value={transaction.paymentScope} />
              <Row label="Completed" value={formatBoolean(transaction.completed)} />
              <Row label="Flagged" value={formatBoolean(transaction.flagged)} />
            </dl>
          </section>

          <section className="group">
            <h3>Amounts</h3>
            <dl>
              <Row label="Amount" value={formatMoney(transaction.amount, currency)} />
              <Row
                label="Fee"
                value={transaction.fee === undefined ? null : formatMoney(transaction.fee, currency)}
              />
              <Row
                label="Payable"
                value={
                  transaction.payableAmount === undefined
                    ? null
                    : formatMoney(transaction.payableAmount, currency)
                }
              />
              <Row label="Currency" value={currency} />
            </dl>
          </section>

          <section className="group">
            <h3>Timing</h3>
            <dl>
              <Row label="Created" value={formatDateTime(transaction.createdOn)} />
              <Row
                label="Completed"
                value={transaction.completedOn ? formatDateTime(transaction.completedOn) : null}
              />
            </dl>
          </section>

          <section className="group">
            <h3>Customer</h3>
            <dl>
              <Row label="Email" value={transaction.customerDTO?.email} copy onCopy={onCopy} />
              <Row label="Name" value={transaction.customerDTO?.name} />
            </dl>
          </section>

          <section className="group">
            <h3>Merchant</h3>
            <dl>
              <Row label="Name" value={transaction.merchantName} />
              <Row label="Code" value={transaction.merchantCode} mono />
              <Row label="Support" value={transaction.merchantSupportEmail} />
            </dl>
          </section>

          <section className="group">
            <h3>Allowed methods</h3>
            <dl>
              <Row label="Methods" value={(transaction.paymentMethodList ?? []).join(', ')} />
            </dl>
          </section>

          {metadata.length > 0 && (
            <section className="group">
              <h3>Metadata</h3>
              <dl>
                {metadata.map(([key, value]) => (
                  <Row
                    key={key}
                    label={key}
                    value={typeof value === 'object' ? JSON.stringify(value) : value}
                  />
                ))}
              </dl>
            </section>
          )}

          <details className="raw">
            <summary>Raw JSON</summary>
            <pre>{JSON.stringify(transaction, null, 2)}</pre>
          </details>
        </div>
      </aside>
    </>
  );
}
