export const UPSTREAM_SEARCH_PATH = '/api/v1/transactions/search';

export const PAYMENT_STATUSES = [
  'PAID',
  'OVERPAID',
  'PARTIALLY_PAID',
  'PENDING',
  'FAILED',
  'EXPIRED',
  'CANCELLED',
  'REVERSED',
  'ABANDONED',
];

export const STATUS_TONE = {
  PAID: 'ok',
  OVERPAID: 'ok',
  PENDING: 'warn',
  PARTIALLY_PAID: 'warn',
  FAILED: 'bad',
  CANCELLED: 'bad',
  REVERSED: 'bad',
};

/**
 * The nine statuses collapse into four outcomes for the overview: money in, money
 * still expected, registrations that simply lapsed, and payments that went wrong.
 * Anything unrecognised falls into an "Other" bucket rather than being dropped.
 */
export const STATUS_GROUPS = [
  { key: 'settled', label: 'Settled', tone: 'ok', statuses: ['PAID', 'OVERPAID'] },
  { key: 'awaiting', label: 'Awaiting payment', tone: 'warn', statuses: ['PENDING', 'PARTIALLY_PAID'] },
  { key: 'lapsed', label: 'Expired or abandoned', tone: 'idle', statuses: ['EXPIRED', 'ABANDONED'] },
  { key: 'failed', label: 'Failed or cancelled', tone: 'bad', statuses: ['FAILED', 'CANCELLED', 'REVERSED'] },
];

/** Shortcuts beside the page-size box; any whole number can still be typed. */
export const PAGE_SIZE_PRESETS = [20, 50, 100, 500, 5000];

export const DEFAULT_PAGE_SIZE = 20;

// Monnify rejects anything below 1 ("Page size must not be less than 1") and
// enforces no upper bound — size=10000 simply returns everything available.
export const MIN_PAGE_SIZE = 1;

// Past this, the request and the render both get noticeably slower: 5000 rows is
// ~2.8MB and about 5s upstream. Worth telling the user rather than hiding.
export const HEAVY_PAGE_SIZE = 500;

// The overview cannot ask Monnify for totals — there is no aggregate endpoint — so
// it pages through the whole result set and tallies locally. 2000 answers in a
// couple of seconds and stays well inside the proxy's 25s timeout; ten of them
// covers 20,000 transactions. Beyond that the sweep stops and the UI says so.
export const SWEEP_PAGE_SIZE = 2000;
export const MAX_SWEEP_PAGES = 10;
