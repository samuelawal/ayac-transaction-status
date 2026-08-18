# AYAC Transaction Status

React front end for the two endpoints in the `YAF` Postman collection.

| Collection request | Monnify endpoint | Who calls it |
| --- | --- | --- |
| **Authentication** | `POST /api/v1/auth/login` (Basic auth) | the server, on its own |
| **Get Transaction Status v1** / **… by Payment Reference** | `GET /api/v1/transactions/search` (Bearer auth) | the browser, via `GET /api/transactions` |

## Run it

```bash
npm install
cp .env.example .env      # then fill in the two keys
npm run dev               # app on http://localhost:5173, API proxy on :4000
```

Production-style run:

```bash
npm run build && npm start   # one server on :4000 serving dist/ and /api
```

`server.js` changes need a restart of the API process; Vite hot-reloads the front end.

## Deploying to Vercel

Vercel serves `dist/` as static files and runs each file in `api/` as a serverless
function. It does **not** run `server.js` — a long-lived Node HTTP server is not a
Vercel entry point, which is why `/api/session` 404s if the routes only exist there.
So the Monnify logic lives in [api/_monnify.js](api/_monnify.js) and is shared by:

| Route | File | Used by |
| --- | --- | --- |
| `GET /api/session` | [api/session.js](api/session.js) | Vercel |
| `GET /api/transactions` | [api/transactions.js](api/transactions.js) | Vercel |
| both, plus `dist/` | [server.js](server.js) | local dev only |

One implementation, so local and deployed behaviour cannot drift apart. The `_`
prefix on `_monnify.js` keeps Vercel from turning it into a route.

**Set the environment variables in Vercel** — Project → Settings → Environment
Variables. `.env` is gitignored and never deployed, so without these the app shows
its setup screen:

| Variable | Value |
| --- | --- |
| `MONNIFY_API_KEY` | the merchant's API key |
| `MONNIFY_SECRET_KEY` | the merchant's secret key |
| `MONNIFY_ENV` | `sandbox` or `live` |
| `BASE_URL` | optional override |

Skip `PORT` — Vercel assigns it. Environment variable changes only take effect on a
**new deployment**, so redeploy after adding them.

The upstream timeout is 9s, inside Vercel's default 10s function limit, so a slow
call returns a readable `502` rather than Vercel's timeout page. Raise that timeout
and `maxDuration` together if large pages ever need longer.

## Credentials

The server holds them; the browser never sees them. There is no sign-in screen.

```ini
MONNIFY_ENV=sandbox          # sandbox | live
MONNIFY_API_KEY=...
MONNIFY_SECRET_KEY=...
PORT=4000
BASE_URL=                    # optional: overrides the URL for MONNIFY_ENV
```

On the first request the server base64-encodes `apiKey:secretKey`, calls
`/api/v1/auth/login`, and caches the access token until a minute before `expiresIn`
lapses — a burst of searches costs one sign-in, not one per search (verified: four
searches, one sign-in). Concurrent requests during a sign-in share the same
in-flight login. A `401` from Monnify forces one re-auth and retry.

If the keys are missing or rejected, `GET /api/session` returns `503` and the app
shows a setup screen naming the variables to set instead of a blank failure.

**The environment chip follows the URL actually in use, not `MONNIFY_ENV`.** Setting
`BASE_URL` to production while `MONNIFY_ENV=sandbox` labels the header `live`, in
red — real money should never be mistaken for test data.

> **Access control:** anyone who can reach the port can read every transaction for
> the merchant, because the server authenticates itself. Fine on a laptop. Put it
> behind auth (SSO proxy, VPN, password layer) before exposing it.

## Why there is a server at all

The page cannot call Monnify directly: Monnify sends no CORS headers, so a browser
request is blocked; and the Basic credential is `base64(apiKey:secretKey)`, so
building it client-side would ship the secret key to every visitor.
[server.js](server.js) does both jobs, using **axios** for every upstream call.
`BASE_URLS` is an allow-list, so the proxy cannot be aimed at an arbitrary host.

## Filters

Every query parameter from the collection, all optional, all combinable — the same
model as ticking rows in Postman's Params tab. Leaving everything blank lists the
merchant's transactions newest first.

| Filter | Sent as | Honoured upstream? |
| --- | --- | --- |
| Payment reference | `paymentReference` | yes |
| Transaction reference | `transactionReference` (+ optional `useTxRef=true`) | yes |
| Customer email | `customerEmail` | yes |
| Customer name | `customerName` | yes |
| From / To | `from`, `to` as epoch ms | yes |
| Per page | `size`, with `page` | yes |
| Status | `paymentStatus` | **no — see below** |

Transaction references are URL-encoded so `|` becomes `%7C`, which is what the
collection's `encodeURIComponent` pre-request script did. Dates are entered as local
datetimes and sent as epoch milliseconds, matching the collection's date script.

The exact query string being sent is under **Request** in the filter panel, ready to
paste back into Postman.

### paymentStatus is accepted and then ignored

Measured against the live API (Aug 2026):

| Query | `totalElements` |
| --- | --- |
| no filters | 3830 |
| `paymentStatus=PAID` | 3830 |
| `paymentStatus=FAILED` | 3830 |
| `from`+`to` | 776 |
| `from`+`to`+`paymentStatus=PAID` | 776 |

An invalid value *is* rejected (`Invalid value 'GARBAGE' for field 'paymentStatus'`),
so the endpoint validates the enum and then discards it.

The app still sends the param — for parity with the collection, and so it starts
working if Monnify ever honours it — and narrows the returned rows itself. Because
that narrowing only covers the rows on the current page, the results header says so
and suggests raising **per page** to widen the net. A page-local filter must never
read as a whole-search one.

## Results

The Spring `Page` envelope (`content`, `totalElements`, `totalPages`, `first`,
`last`) renders as a table — status, amount, customer, both references, method,
created — with a header line carrying the whole-search total, the visible slice, and
settled/pending counts for the page. Clicking a row opens a detail drawer with
references (copy buttons), amounts, fees, timing, customer, merchant, allowed
payment methods, metadata and the raw JSON. A lookup landing on exactly one row
opens its drawer automatically.

Amounts use the `en-NG` locale so `NGN` always renders as `₦` rather than the bare
currency code, whatever the viewer's locale.

Below 720px the table stops being a table: each transaction becomes one labelled
block, so nothing needs sideways scrolling. The filter grid steps 4 → 3 → 2 → 1
column.

## Branding

`public/logo.png` is the Living Faith Church emblem — the flame-and-shield globe —
sourced from the [Wikipedia
file](https://en.wikipedia.org/wiki/File:Winnerschapellogo.gif) at 300×331 and
converted to a transparent PNG. It is the grey-shield rendition; if you have the
official high-resolution or vector artwork, **overwrite `public/logo.png`** and
everything updates, including the favicon. Only the `width`/`height` pair in
[src/components/AppHeader.jsx](src/components/AppHeader.jsx) assumes the 300×331
aspect ratio.

Type is **Raleway**, self-hosted via `@fontsource-variable/raleway` — bundled as
woff2, so there is no request to Google Fonts.

Red is the church's colour and is spent sparingly: the emblem, the primary button,
focus rings, and the live-environment warning. Transaction status keeps a separate
green / amber / crimson scale, so `PAID` and `FAILED` are never told apart by hue
alone against a red interface. Light and dark themes both follow the system setting.

## Files

```
api/_monnify.js                    config, token cache, axios search — shared
api/session.js                     GET /api/session      (Vercel function)
api/transactions.js                GET /api/transactions (Vercel function)
server.js                          local dev: same routes + .env loading + dist serving
vite.config.js                     dev server + /api proxy to :4000
index.html                         Vite entry
public/logo.png                    ← overwrite to change the emblem and favicon
src/api/monnify.js                 axios client for /api/session and /api/transactions
src/hooks/useServerSession.js      startup credential check
src/hooks/useTransactionSearch.js  query, paging, stale-response guard
src/hooks/useToast.js
src/lib/constants.js               statuses, tones, page sizes
src/lib/format.js                  money, dates, error messages
src/lib/params.js                  form → v1 query params, request preview
src/lib/rows.js                    local paymentStatus narrowing
src/components/                    AppHeader, FilterBar, ResultsCard, StatusDot,
                                   TransactionDrawer, SetupNotice
src/styles.css                     tokens, layout, responsive rules
```

## Notes

- The collection's v1 requests use both `/search` and `/search/`. The proxy tries
  `/search` and retries with the trailing slash on a `404`.
- Status options: `PAID`, `OVERPAID`, `PARTIALLY_PAID`, `PENDING`, `FAILED`,
  `EXPIRED`, `CANCELLED`, `REVERSED`, `ABANDONED`.
