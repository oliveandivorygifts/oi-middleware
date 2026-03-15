# @oliveandivorygifts/middleware

Edge-safe middleware pipeline for Cloudflare Workers, Pages, Hono, and Next.js.

## Install

```bash
npm install @oliveandivorygifts/middleware
```

## What's included

### Middleware

- **withRequestContext** — Populates correlation ID, request ID, IP, user-agent
- **withAuthHmac** — HMAC-SHA256 request verification with replay protection
- **withCors** — CORS headers and preflight handling
- **withJsonBody** — JSON body parsing with size limits
- **withRateLimit** — D1 or in-memory rate limiting
- **withLogging** — Structured logging to D1 or console with sampling
- **withErrorHandling** — Catches errors and returns structured JSON
- **withEnvValidation** — Validates required environment bindings

### Adapters

- **hono** / **withHonoPipeline** — Hono middleware adapter
- **nextjs** / **withNextJsPipeline** — Next.js API route adapter
- **cloudflare** / **withCloudflarePipeline** — Cloudflare Workers adapter

### Helpers

- **jsonOk** / **jsonError** / **noContent** / **redirect** — Response builders
- **classifyError** — Maps errors to HTTP status codes
- **formatCurrency** — AUD cents to dollar string
- **fetchJson** — Fetch wrapper with structured error handling
- **createSignedHeaders** / **signedApiFetch** — HMAC-signed API requests
- **redactSensitive** / **safeJsonStringify** — Log-safe serialization

### Domain Models

Shared TypeScript types: Order, Gift, Collection, Item, DeliveryZone, etc.

## Development

```bash
npm install
npm run lint
npm run typecheck
npm test
npm run build
```
