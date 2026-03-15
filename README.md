# @oliveandivorygifts/middleware

Edge-safe middleware pipeline for Cloudflare Workers, Pages, Hono, and Next.js.

## Install

```bash
npm install @oliveandivorygifts/middleware
```

Requires `.npmrc` with:
```
@oliveandivorygifts:registry=https://npm.pkg.github.com
```

## Repository Structure

```
oi-middleware/
├── .github/workflows/ci.yml    # CI: lint -> typecheck -> test -> publish on tag
├── src/
│   ├── index.ts                 # Public barrel export
│   ├── types.ts                 # All shared type definitions
│   ├── pipeline.ts              # Middleware pipeline runner (compose, runPipeline)
│   ├── actions.ts               # Observability action constants
│   ├── models.ts                # Domain models (Order, Gift, Collection, Item, etc.)
│   ├── middleware/
│   │   ├── auth-hmac.ts         # HMAC-SHA256 request verification + replay protection
│   │   ├── cors.ts              # CORS headers and OPTIONS preflight
│   │   ├── error-handling.ts    # Catch-all error -> JSON response
│   │   ├── json-body.ts         # JSON body parsing with size limits
│   │   ├── logging.ts           # Structured logging to D1/console with sampling
│   │   ├── rate-limit.ts        # D1 or in-memory rate limiting
│   │   └── request-context.ts   # Populates correlation ID, IP, user-agent, route
│   ├── helpers/
│   │   ├── classify-error.ts    # Maps errors to HTTP status codes (D1, Zod, HMAC, etc.)
│   │   ├── currency.ts          # AUD cents -> "$12.34" formatting
│   │   ├── env-validation.ts    # Middleware to validate required env bindings
│   │   ├── fetch-json.ts        # Fetch wrapper with FetchJsonError for structured errors
│   │   ├── json-error.ts        # Response builders: jsonOk, jsonError, noContent, redirect
│   │   ├── logging.ts           # Log sinks (ConsoleSink, D1EventLogsSink), redaction, truncation
│   │   ├── request-context.ts   # resolveRequestIds, getHeaderCaseInsensitive
│   │   └── signing.ts           # createSignedHeaders, signedApiFetch for outbound HMAC requests
│   └── adapters/
│       ├── hono.ts              # Hono middleware adapter (withHonoPipeline)
│       ├── nextjs.ts            # Next.js API route adapter (withNextJsPipeline)
│       └── cloudflare.ts        # Cloudflare Workers adapter (withCloudflarePipeline)
├── tests/
│   ├── helpers.test.ts          # jsonOk, jsonError, noContent, redirect, attachRequestHeaders
│   ├── logging.test.ts          # redactSensitive, truncateText, safeJsonStringify
│   ├── currency.test.ts         # formatCurrency
│   ├── fetch-json.test.ts       # fetchJson, FetchJsonError
│   ├── pipeline.test.ts         # runPipeline, withJsonBody, withErrorHandling, withAuthHmac
│   └── rate-limit.test.ts       # resolveRequestIds, classifyError, rate limit window helpers
├── biome.json                   # Biome linter/formatter config
├── tsconfig.json                # TypeScript strict config
├── tsconfig.build.json          # Build-only config (excludes tests)
├── vitest.config.ts             # Vitest test runner config
├── package.json                 # @oliveandivorygifts/middleware, type: module, ESM
└── .npmrc                       # GitHub Packages registry
```

## Middleware

| Middleware | File | Purpose |
|------------|------|---------|
| `withRequestContext()` | `middleware/request-context.ts` | Populates `correlation_id`, `request_id`, IP, user-agent, route, method on context |
| `withAuthHmac(config)` | `middleware/auth-hmac.ts` | HMAC-SHA256 request verification with configurable tolerance, skip rules, and nonce replay protection via D1 |
| `withCors(options?)` | `middleware/cors.ts` | Sets CORS headers, handles OPTIONS preflight |
| `withJsonBody(limit?, allowEmpty?)` | `middleware/json-body.ts` | Parses JSON bodies, enforces size limit, stores in `context.state.parsed_body` |
| `withRateLimit(config)` | `middleware/rate-limit.ts` | Per-IP rate limiting via D1 or in-memory store with configurable window/limit/skip |
| `withLogging(options?)` | `middleware/logging.ts` | Structured HTTP logging to D1 or console, with sample rate and slow-request override |
| `withErrorHandling()` | `middleware/error-handling.ts` | Catches unhandled errors, classifies them, returns structured JSON |
| `withEnvValidation(keys)` | `helpers/env-validation.ts` | Validates required environment bindings exist |

## Adapters

| Adapter | File | Usage |
|---------|------|-------|
| `hono(middlewares)` / `withHonoPipeline` | `adapters/hono.ts` | Wraps middleware pipeline as Hono middleware handler |
| `nextjs(middlewares, handler)` / `withNextJsPipeline` | `adapters/nextjs.ts` | Wraps middleware pipeline for Next.js API routes (resolves Cloudflare env) |
| `cloudflare(middlewares, handler)` / `withCloudflarePipeline` | `adapters/cloudflare.ts` | Wraps middleware pipeline for raw Cloudflare Workers fetch handler |

## Response Helpers

| Function | File | Returns |
|----------|------|---------|
| `jsonOk(data, status?, context?)` | `helpers/json-error.ts` | `200` JSON response with correlation headers |
| `jsonError(error, context?)` | `helpers/json-error.ts` | Error response: `{ ok: false, error: { code, message, correlation_id } }` |
| `noContent(context?)` | `helpers/json-error.ts` | `204` empty response |
| `redirect(url, status?, context?)` | `helpers/json-error.ts` | `302` redirect with location header |
| `attachRequestHeaders(response, context?)` | `helpers/json-error.ts` | Adds `x-correlation-id` and `x-request-id` to response |

## Error Classification

`classifyError(error)` in `helpers/classify-error.ts` maps errors to HTTP status codes:

| Error Pattern | Status | Code |
|---------------|--------|------|
| D1 UNIQUE constraint | 409 | `constraint_error` |
| D1 no such table/column | 500 | `schema_mismatch` |
| Validation / Zod | 400 | `validation_error` |
| Signature / HMAC | 401 | `unauthorized` |
| Forbidden | 403 | `forbidden` |
| Rate limit | 429 | `rate_limited` |
| Everything else | 500 | `internal_error` |

## Shared Utilities

| Function | File | Purpose |
|----------|------|---------|
| `formatCurrency(cents)` | `helpers/currency.ts` | Formats integer cents to AUD string (`1234` -> `"$12.34"`) |
| `fetchJson<T>(input, init?)` | `helpers/fetch-json.ts` | Fetch wrapper that throws `FetchJsonError` on non-2xx or `{ ok: false }` |
| `createSignedHeaders(args)` | `helpers/signing.ts` | Creates HMAC-signed headers for outbound API requests |
| `signedApiFetch<T>(args)` | `helpers/signing.ts` | Full signed fetch with IP/user-agent forwarding |
| `redactSensitive(value)` | `helpers/logging.ts` | Recursively redacts sensitive keys (tokens, secrets, passwords) |
| `safeJsonStringify(value, maxLength?)` | `helpers/logging.ts` | Redacts + stringifies + truncates for safe logging |
| `truncateText(text, maxLength?)` | `helpers/logging.ts` | Truncates with `...` ellipsis |
| `resolveRequestIds(request, cfRay?, generateId?)` | `helpers/request-context.ts` | Extracts/generates correlation and request IDs |
| `getHeaderCaseInsensitive(headers, name)` | `helpers/request-context.ts` | Case-insensitive header lookup |
| `createHmacSignature(secret, payload)` | `middleware/auth-hmac.ts` | Raw HMAC-SHA256 base64 signature |
| `verifyHmacSignature({ secret, payload, signature })` | `middleware/auth-hmac.ts` | Constant-time HMAC verification |

## Domain Models

All in `src/models.ts`:

| Type | Description |
|------|-------------|
| `Order` | Customer order with delivery, payment, and status fields |
| `OrderItem` | Line item in an order |
| `OrderWithItems` | Order with nested items array |
| `OrderStatus` | `"pending" \| "paid" \| "packed" \| "out_for_delivery" \| "delivered" \| "cancelled" \| "expired"` |
| `Item` | Inventory item (stock, pricing, units) |
| `Collection` | Gift collection with SEO, pricing, status |
| `CollectionItemRow` | Junction: collection <-> item with quantity/sort |
| `CollectionWithItems` | Collection with nested items and optional gifts |
| `CollectionComponent` | Denormalized collection component view |
| `CollectionWithImage` | Collection with computed image URLs, stock, fulfillment |
| `CollectionVariant` | Size/tier variant of a collection |
| `CollectionVariantItem` | Junction: variant <-> item |
| `CollectionVariantTile` | Display-ready variant tile |
| `Gift` | Gift product with media, SEO, categorization |
| `GiftMedia` | Image attached to a gift with focal point and variants |
| `GiftAiRun` | AI copy generation run record |
| `DeliveryZone` | Delivery area with fee |
| `Faq` | FAQ entry |
| `FeaturedCollectionWithGifts` | Featured collection display bundle |

## Pipeline Types

All in `src/types.ts`:

| Type | Description |
|------|-------------|
| `AppEnv` | Environment bindings (DB, KV, secrets, log config) |
| `D1DatabaseLike` | Minimal D1 interface for edge compatibility |
| `D1StatementLike` | D1 prepared statement interface |
| `WorkerExecutionContext` | Cloudflare execution context (waitUntil) |
| `RequestContext` | Request metadata (IDs, IP, route, method) |
| `MiddlewareContext` | Full context: RequestContext + env + state |
| `ApiError` | Structured error with code, message, status, headers |
| `ApiResult<T>` | Standard response envelope `{ ok, data?, error? }` |
| `PaginationResult<T>` | Paginated list `{ items, next_cursor, total }` |
| `LogLevel` | `"debug" \| "info" \| "warn" \| "error" \| "security"` |
| `LogEvent` | Structured log entry |
| `LogSink` | Log sink interface (write method) |
| `RateLimitConfig` | Rate limiter configuration |
| `AuthHmacConfig` | HMAC auth configuration |
| `MiddlewareFunction` | `(request, context, next) => Promise<Response>` |
| `HandlerFunction` | `(request, context) => Promise<Response> \| Response` |
| `NextFunction` | `() => Promise<Response>` |

## Observability Actions

Constants in `src/actions.ts` for structured logging:

| Constant | Value |
|----------|-------|
| `OBSERVABILITY_ACTIONS.HTTP_REQUEST` | `"http.request"` |
| `OBSERVABILITY_ACTIONS.HTTP_RESPONSE` | `"http.response"` |
| `OBSERVABILITY_ACTIONS.HTTP_ERROR` | `"http.error"` |
| `OBSERVABILITY_ACTIONS.AUTH_HMAC_OK` | `"auth.hmac.ok"` |
| `OBSERVABILITY_ACTIONS.AUTH_HMAC_FAIL` | `"auth.hmac.fail"` |
| `OBSERVABILITY_ACTIONS.RATE_LIMIT_OK` | `"rate_limit.ok"` |
| `OBSERVABILITY_ACTIONS.RATE_LIMIT_BLOCK` | `"rate_limit.block"` |
| `OBSERVABILITY_ACTIONS.DB_QUERY` | `"db.query"` |
| `OBSERVABILITY_ACTIONS.DB_ERROR` | `"db.error"` |
| `OBSERVABILITY_ACTIONS.ADMIN_AUDIT` | `"admin.audit"` |

## Development

```bash
npm install
npm run lint        # Biome check
npm run typecheck   # tsc --noEmit
npm test            # Vitest (42 tests)
npm run build       # tsup -> dist/
```

## Publishing

Publish happens automatically via GitHub Actions when a version tag is pushed:

```bash
npm version patch   # bumps version in package.json
git push --tags     # triggers CI -> publish to GitHub Packages
```

## Consumers

This package is used by:
- **oi-api** (Hono worker) — via `withHonoPipeline` adapter
- **oi-admin** (Next.js) — via `withNextJsPipeline` adapter
- **oi-storefront** (Next.js) — via `withNextJsPipeline` adapter (note: storefront uses a local `signing.ts` copy because OpenNext cannot resolve this package at runtime)
