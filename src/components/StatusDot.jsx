import { STATUS_TONE } from '../lib/constants';
import { humanStatus } from '../lib/rows';

/** A dot plus the status word — quieter than a pill, and readable at table density. */
export default function StatusDot({ status }) {
  return (
    <span className="status">
      <i className={`dot ${STATUS_TONE[status] ?? 'idle'}`} aria-hidden="true" />
      {humanStatus(status) || 'Unknown'}
    </span>
  );
}
