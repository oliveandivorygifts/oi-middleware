/**
 * @dependencies
 * - src/middleware/auth-hmac.ts — createHmacSignature
 */

/**
 * Outbound HMAC request signing helpers.
 * Used by frontends to sign API calls so the auth-hmac middleware accepts them.
 *
 * @module
 */

import { createHmacSignature } from "../middleware/auth-hmac.js";

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Create HMAC-signed headers for outbound API requests. */
export async function createSignedHeaders(args: {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  bodyText: string;
  secret: string;
  correlationId?: string;
}) {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const nonce = crypto.randomUUID();
  const bodyHash = await sha256Hex(args.bodyText);
  const signaturePath = args.path || "/";
  const payloadString = `${args.method}\n${signaturePath}\n${timestamp}\n${nonce}\n${bodyHash}`;
  const signature = await createHmacSignature(args.secret, payloadString);

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-oi-timestamp": timestamp,
    "x-oi-nonce": nonce,
    "x-oi-signature": signature,
  };
  if (args.correlationId) {
    headers["x-correlation-id"] = args.correlationId;
  }
  return headers;
}

/** Perform a fetch with HMAC-signed headers, forwarding client IP and user-agent. */
export async function signedApiFetch<T = Record<string, unknown>>(args: {
  baseUrl: string;
  secret: string;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  body?: unknown;
  correlationId?: string;
  clientHeaders?: Headers | Record<string, string> | null;
}) {
  const { baseUrl, secret } = args;

  if (!secret) {
    return {
      ok: false,
      status: 500,
      data: { ok: false, error: "Configuration error: missing HMAC_SHARED_SECRET" } as T,
    };
  }

  const bodyText = args.body === undefined ? "" : JSON.stringify(args.body);
  const headers = await createSignedHeaders({
    method: args.method,
    path: args.path,
    bodyText,
    secret,
    correlationId: args.correlationId,
  });

  const getHeader = (key: string) => {
    if (!args.clientHeaders) return undefined;
    if (typeof (args.clientHeaders as Headers).get === "function") {
      return (args.clientHeaders as Headers).get(key);
    }
    return (args.clientHeaders as Record<string, string>)[key];
  };

  const cfConnectingIp = getHeader("cf-connecting-ip")?.trim();
  const forwardedFor = getHeader("x-forwarded-for")?.trim();
  const userAgent = getHeader("user-agent")?.trim();

  if (cfConnectingIp) headers["cf-connecting-ip"] = cfConnectingIp;
  if (forwardedFor) headers["x-forwarded-for"] = forwardedFor;
  if (userAgent) headers["user-agent"] = userAgent;

  const res = await fetch(`${baseUrl}${args.path}`, {
    method: args.method,
    headers,
    body: bodyText || undefined,
  });

  const text = await res.text();
  let json: T | Record<string, string> | null = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }

  return { ok: res.ok, status: res.status, data: json as T };
}
