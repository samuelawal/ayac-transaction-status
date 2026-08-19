import { STATUS_GROUPS } from './constants';

/**
 * Tallies a set of transactions into the numbers the overview shows.
 *
 * Monnify's v1 API has no aggregate endpoint, so every figure here is counted from
 * rows the sweep actually fetched. Pure and synchronous: give it rows, get totals.
 */

/** status -> group, flattened once from the group definitions. */
const GROUP_OF = new Map(
  STATUS_GROUPS.flatMap((group) => group.statuses.map((status) => [status, group.key])),
);

const OTHER = { key: 'other', label: 'Other', tone: 'idle' };

/**
 * Who a transaction belongs to. Email is the reliable identity; a name is the next
 * best thing. With neither, the row counts as its own customer — merging every
 * anonymous transaction into a single "customer" would understate the headcount.
 */
function customerKey(row, index) {
  const email = row.customerDTO?.email?.trim().toLowerCase();
  if (email) return `e:${email}`;
  const name = row.customerDTO?.name?.trim().toLowerCase();
  if (name) return `n:${name}`;
  return `t:${row.transactionReference || row.paymentReference || index}`;
}

/** Highest count wins; ties break on first seen. */
function dominant(counts, fallback) {
  let best = fallback;
  let bestCount = 0;
  for (const [value, count] of counts) {
    if (count > bestCount) {
      best = value;
      bestCount = count;
    }
  }
  return best;
}

function share(part, whole) {
  return whole > 0 ? part / whole : 0;
}

export function summarise(rows) {
  const byStatus = new Map(); // status -> { count, value }
  const byMethod = new Map(); // method -> count
  const byCustomer = new Map(); // key -> { count, settled, paid }
  const byCurrency = new Map(); // code -> count
  const byGroup = new Map(); // group key -> { count, value }

  let earliest = null;
  let latest = null;

  rows.forEach((row, index) => {
    const status = row.paymentStatus || 'UNKNOWN';
    const parsed = Number(row.amount);
    const amount = Number.isFinite(parsed) ? parsed : 0;
    const groupKey = GROUP_OF.get(status) ?? OTHER.key;

    const statusTally = byStatus.get(status) ?? { count: 0, value: 0 };
    statusTally.count += 1;
    statusTally.value += amount;
    byStatus.set(status, statusTally);

    const groupTally = byGroup.get(groupKey) ?? { count: 0, value: 0 };
    groupTally.count += 1;
    groupTally.value += amount;
    byGroup.set(groupKey, groupTally);

    const method = row.paymentMethod || 'Not recorded';
    byMethod.set(method, (byMethod.get(method) ?? 0) + 1);

    const currency = row.currencyCode || 'NGN';
    byCurrency.set(currency, (byCurrency.get(currency) ?? 0) + 1);

    const key = customerKey(row, index);
    const customer = byCustomer.get(key) ?? { count: 0, settled: 0, paid: 0 };
    customer.count += 1;
    if (groupKey === 'settled') {
      customer.settled += 1;
      customer.paid += amount;
    }
    byCustomer.set(key, customer);

    const created = Date.parse(row.createdOn);
    if (Number.isFinite(created)) {
      if (earliest === null || created < earliest) earliest = created;
      if (latest === null || created > latest) latest = created;
    }
  });

  const total = rows.length;
  const empty = { count: 0, value: 0 };
  const settled = byGroup.get('settled') ?? empty;
  const awaiting = byGroup.get('awaiting') ?? empty;
  const lapsed = byGroup.get('lapsed') ?? empty;
  const failed = byGroup.get('failed') ?? empty;

  const people = [...byCustomer.values()];
  const paidCustomers = people.filter((customer) => customer.settled > 0).length;

  const groups = [...STATUS_GROUPS, OTHER]
    .map((group) => {
      const tally = byGroup.get(group.key) ?? empty;
      return { ...group, ...tally, share: share(tally.count, total) };
    })
    // "Other" only earns a slot when something actually landed in it.
    .filter((group) => group.key !== OTHER.key || group.count > 0);

  const statuses = [...byStatus.entries()]
    .map(([status, tally]) => ({ status, ...tally, share: share(tally.count, total) }))
    .sort((a, b) => b.count - a.count);

  const methods = [...byMethod.entries()]
    .map(([method, count]) => ({ method, count, share: share(count, total) }))
    .sort((a, b) => b.count - a.count);

  return {
    total,
    currency: dominant(byCurrency, 'NGN'),
    mixedCurrency: byCurrency.size > 1,
    customers: {
      total: byCustomer.size,
      paid: paidCustomers,
      unpaid: byCustomer.size - paidCustomers,
      repeat: people.filter((customer) => customer.count > 1).length,
    },
    money: {
      collected: settled.value,
      outstanding: awaiting.value,
      lapsed: lapsed.value,
      failed: failed.value,
      averagePaid: settled.count > 0 ? settled.value / settled.count : 0,
    },
    counts: {
      settled: settled.count,
      awaiting: awaiting.count,
      lapsed: lapsed.count,
      failed: failed.count,
    },
    settlementRate: share(settled.count, total),
    groups,
    statuses,
    methods,
    range: { from: earliest, to: latest },
  };
}
