/**
 * Monnify's v1 search validates `paymentStatus` (an invalid enum is rejected) but
 * does not apply it — `paymentStatus=PAID`, `paymentStatus=FAILED` and no filter at
 * all return the same totalElements. Verified against the live API, Aug 2026.
 *
 * The param is still sent upstream, for parity with the Postman collection and so
 * the app starts working properly if Monnify ever honours it. Until then the
 * narrowing happens here, over the rows the server actually returned — and the UI
 * says so, because a page-local filter must never read as a whole-search one.
 */
export function narrowByStatus(rows, status) {
  if (!status) return rows;
  return rows.filter((row) => row.paymentStatus === status);
}

/** "PARTIALLY_PAID" -> "Partially paid" */
export function humanStatus(status) {
  if (!status) return '';
  return status.charAt(0) + status.slice(1).toLowerCase().replace(/_/g, ' ');
}
