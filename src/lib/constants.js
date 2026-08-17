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

export const PAGE_SIZES = [10, 20, 50, 100, 200];
