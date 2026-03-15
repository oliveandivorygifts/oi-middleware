/**
 * Canonical action strings for structured observability events.
 * Keeps log/metric action names consistent across all middleware layers.
 *
 * @module
 */

/** Well-known action identifiers referenced by logging and audit middleware. */
export const OBSERVABILITY_ACTIONS = {
  HTTP_REQUEST: "http.request",
  HTTP_RESPONSE: "http.response",
  HTTP_ERROR: "http.error",
  AUTH_HMAC_OK: "auth.hmac.ok",
  AUTH_HMAC_FAIL: "auth.hmac.fail",
  RATE_LIMIT_OK: "rate_limit.ok",
  RATE_LIMIT_BLOCK: "rate_limit.block",
  DB_QUERY: "db.query",
  DB_ERROR: "db.error",
  ADMIN_AUDIT: "admin.audit",
} as const;

/** Union of all recognised observability action strings. */
export type ObservabilityAction = (typeof OBSERVABILITY_ACTIONS)[keyof typeof OBSERVABILITY_ACTIONS];
