/**
 * @dependencies
 * - src/types.ts              — AuthHmacConfig, MiddlewareFunction
 * - src/actions.ts            — OBSERVABILITY_ACTIONS
 * - src/helpers/json-error.ts — jsonError
 */

import { OBSERVABILITY_ACTIONS } from "../actions.js";
import { jsonError } from "../helpers/json-error.js";
import type { AuthHmacConfig, MiddlewareFunction } from "../types.js";

async function sha256Hex(input: string): Promise<string> {
  const inputBytes = new TextEncoder().encode(input);
  const digestBuffer = await crypto.subtle.digest("SHA-256", inputBytes);
  return [...new Uint8Array(digestBuffer)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function hmacBase64(secret: string, payload: string): Promise<string> {
  const secretBytes = new TextEncoder().encode(secret);
  const cryptoKey = await crypto.subtle.importKey("raw", secretBytes, { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ]);
  const signatureBuffer = await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(payload));
  return btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)));
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let accumulator = 0;
  for (let index = 0; index < a.length; index += 1) {
    accumulator |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return accumulator === 0;
}

/** Create an HMAC-SHA256 signature encoded as base64. */
export async function createHmacSignature(secret: string, payload: string): Promise<string> {
  return hmacBase64(secret, payload);
}

/** Verify an HMAC-SHA256 signature in constant time. */
export async function verifyHmacSignature(input: {
  secret: string;
  payload: string;
  signature: string;
}): Promise<boolean> {
  const expectedSignature = await hmacBase64(input.secret, input.payload);
  return timingSafeEqual(expectedSignature, input.signature);
}

/** Middleware that verifies HMAC-signed requests. */
export function withAuthHmac(configuration: AuthHmacConfig): MiddlewareFunction {
  const toleranceSeconds = configuration.tolerance_seconds ?? 300;

  return async (request, context, next) => {
    if (configuration.skip?.(request, context)) {
      return next();
    }

    const secretValue = String(context.env[configuration.secret_env_key] || "").trim();
    if (!secretValue) {
      return jsonError(
        {
          status: 500,
          code: "misconfiguration",
          message: "Server misconfiguration: missing HMAC secret",
        },
        context,
      );
    }

    const timestamp = request.headers.get("x-oi-timestamp") || "";
    const nonce = request.headers.get("x-oi-nonce") || "";
    const providedSignature = request.headers.get("x-oi-signature") || "";

    if (!timestamp || !nonce || !providedSignature) {
      context.state.auth_action = OBSERVABILITY_ACTIONS.AUTH_HMAC_FAIL;
      return jsonError(
        {
          status: 401,
          code: "unauthorized",
          message: "Missing required HMAC headers",
        },
        context,
      );
    }

    const parsedTimestamp = Number(timestamp);
    if (!Number.isFinite(parsedTimestamp)) {
      context.state.auth_action = OBSERVABILITY_ACTIONS.AUTH_HMAC_FAIL;
      return jsonError(
        {
          status: 401,
          code: "unauthorized",
          message: "Invalid timestamp",
        },
        context,
      );
    }

    const nowSeconds = Math.floor(Date.now() / 1000);
    if (Math.abs(nowSeconds - parsedTimestamp) > toleranceSeconds) {
      context.state.auth_action = OBSERVABILITY_ACTIONS.AUTH_HMAC_FAIL;
      return jsonError(
        {
          status: 401,
          code: "unauthorized",
          message: "Timestamp outside tolerance window",
        },
        context,
      );
    }

    const requestMethod = request.method.toUpperCase();
    const requestBodyText = requestMethod === "GET" || requestMethod === "HEAD" ? "" : await request.clone().text();
    const bodyHash = await sha256Hex(requestBodyText);

    const requestUrl = new URL(request.url);
    const payloadWithQuery = `${requestMethod}\n${requestUrl.pathname}${requestUrl.search}\n${timestamp}\n${nonce}\n${bodyHash}`;

    let expectedSignature = await hmacBase64(secretValue, payloadWithQuery);
    let signatureMatches = timingSafeEqual(expectedSignature, providedSignature);

    // Fall back to legacy payload format (without query string).
    if (!signatureMatches && requestUrl.search) {
      const legacyPayload = `${requestMethod}\n${requestUrl.pathname}\n${timestamp}\n${nonce}\n${bodyHash}`;
      expectedSignature = await hmacBase64(secretValue, legacyPayload);
      signatureMatches = timingSafeEqual(expectedSignature, providedSignature);
    }

    if (!signatureMatches) {
      context.state.auth_action = OBSERVABILITY_ACTIONS.AUTH_HMAC_FAIL;
      return jsonError(
        {
          status: 401,
          code: "unauthorized",
          message: "Invalid signature",
        },
        context,
      );
    }

    context.state.auth_action = OBSERVABILITY_ACTIONS.AUTH_HMAC_OK;

    // Nonce replay protection via D1 UNIQUE constraint.
    if (configuration.replay_protection !== false && context.env.DB) {
      const db = context.env.DB;
      try {
        await db.prepare("INSERT INTO api_nonces (nonce, created_at) VALUES (?, datetime('now'))").bind(nonce).run();
      } catch {
        context.state.auth_action = OBSERVABILITY_ACTIONS.AUTH_HMAC_FAIL;
        return jsonError(
          {
            status: 401,
            code: "unauthorized",
            message: "Request replay detected",
          },
          context,
        );
      }

      // Purge expired nonces. Fire-and-forget; failure is non-fatal.
      db.prepare("DELETE FROM api_nonces WHERE created_at < datetime('now', ? || ' seconds')")
        .bind(`-${toleranceSeconds}`)
        .run()
        .catch(() => undefined);
    }

    return next();
  };
}
