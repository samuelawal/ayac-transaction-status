import { UPSTREAM_SEARCH_PATH } from './constants';

export const EMPTY_FILTERS = {
  paymentReference: '',
  transactionReference: '',
  useTxRef: false,
  customerEmail: '',
  customerName: '',
  paymentStatus: '',
  from: '',
  to: '',
};

/**
 * Turn the filter form into v1 query params. Every field is optional and they
 * combine freely — the same model as ticking rows in Postman's Params tab.
 *
 * `from`/`to` go out as epoch milliseconds, matching the collection's date
 * pre-request script. `transactionReference` is left raw here and URL-encoded by
 * the serializer, which is what the collection's encodeURIComponent call did (the
 * references contain `|`).
 *
 * Throws an Error with a user-facing message when the form is not usable.
 */
export function buildSearchParams(filters) {
  const params = {};

  const text = (value) => (value ?? '').trim();

  const paymentReference = text(filters.paymentReference);
  if (paymentReference) params.paymentReference = paymentReference;

  const transactionReference = text(filters.transactionReference);
  if (transactionReference) {
    params.transactionReference = transactionReference;
    if (filters.useTxRef) params.useTxRef = 'true';
  }

  const customerEmail = text(filters.customerEmail);
  if (customerEmail) params.customerEmail = customerEmail;

  const customerName = text(filters.customerName);
  if (customerName) params.customerName = customerName;

  if (filters.paymentStatus) params.paymentStatus = filters.paymentStatus;

  const from = filters.from ? new Date(filters.from).getTime() : null;
  const to = filters.to ? new Date(filters.to).getTime() : null;
  if (from && to && from > to) throw new Error('The “from” date must come before the “to” date.');
  if (from) params.from = String(from);
  if (to) params.to = String(to);

  return params;
}

/** How many filters are actually in play, for the "N applied" hint. */
export function countActiveFilters(filters) {
  return Object.entries(filters).filter(([key, value]) => {
    if (key === 'useTxRef') return false; // a modifier, not a filter on its own
    return typeof value === 'string' ? value.trim() !== '' : Boolean(value);
  }).length;
}

/** The exact upstream request, so it can be pasted back into Postman. */
export function previewRequest(query, page, size) {
  if (!query) return '';
  const search = new URLSearchParams({ ...query, page: String(page), size: String(size) });
  return `GET ${UPSTREAM_SEARCH_PATH}?${search.toString()}`;
}
