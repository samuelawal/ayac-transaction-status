// Pinned to en-NG so amounts always read as ₦1,000.00. The browser default would
// render NGN as the bare code "NGN 1,000.00" outside Nigerian locales; other
// currency codes still format correctly under this locale.
const MONEY_LOCALE = 'en-NG';

export function formatMoney(amount, currency = 'NGN') {
  if (amount === null || amount === undefined || amount === '') return '—';
  const value = Number(amount);
  if (Number.isNaN(value)) return String(amount);
  try {
    return new Intl.NumberFormat(MONEY_LOCALE, {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    // Unknown currency code — fall back to a plain prefixed amount.
    return `${currency} ${value.toFixed(2)}`;
  }
}

/** Whole units, no kobo — for the overview's large figures, where decimals are noise. */
export function formatMoneyWhole(amount, currency = 'NGN') {
  const value = Number(amount);
  if (!Number.isFinite(value)) return formatMoney(amount, currency);
  try {
    return new Intl.NumberFormat(MONEY_LOCALE, {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${currency} ${Math.round(value).toLocaleString()}`;
  }
}

export function formatDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function formatShortDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString(undefined, {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Just the day, for the span an overview covers. */
export function formatDay(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' });
}

export function formatBoolean(value) {
  if (value === true) return 'Yes';
  if (value === false) return 'No';
  return '—';
}

/** Best available message from an axios error, a Monnify envelope, or a plain Error. */
export function describeError(error) {
  if (error?.envelope) {
    return error.envelope.responseMessage || error.envelope.error || 'Request was not successful.';
  }
  const data = error?.response?.data;
  if (data) {
    if (typeof data === 'string') return data.slice(0, 300);
    return data.responseMessage || data.error || data.message || `HTTP ${error.response.status}`;
  }
  if (error?.code === 'ECONNABORTED') return 'The request timed out.';
  return error?.message || 'Something went wrong.';
}
