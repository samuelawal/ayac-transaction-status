import { STATUS_TONE } from '../lib/constants';
import { humanStatus } from '../lib/rows';

/** Status as a filled pill, tinted by outcome. */
export default function StatusPill({ status }) {
  return <span className={`pill ${STATUS_TONE[status] ?? 'idle'}`}>{humanStatus(status) || 'Unknown'}</span>;
}
