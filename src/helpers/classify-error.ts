/**
 * @dependencies
 * - src/types.ts                     — ApiError
 * - src/middleware/error-handling.ts  — Uses classifyError
 */

/**
 * Error classification helper.
 * Maps arbitrary thrown values to a consistent HTTP status, code, and message
 * so the error-handling middleware can return a uniform JSON shape.
 *
 * @module
 */

import type { ApiError } from "../types.js";

/** Normalised error shape produced by classifyError. */
export interface ClassifiedError {
  status: number;
  code: string;
  message: string;
  details?: Record<string, unknown>;
  headers?: HeadersInit;
}

const INTERNAL_ERROR: ClassifiedError = {
  status: 500,
  code: "internal_error",
  message: "Internal server error",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function fromApiError(candidate: unknown): ClassifiedError | null {
  if (!isRecord(candidate)) {
    return null;
  }

  const status = Number(candidate.status);
  if (!Number.isFinite(status) || status < 400 || status > 599) {
    return null;
  }

  const code = typeof candidate.code === "string" ? candidate.code : status >= 500 ? "internal_error" : "bad_request";
  const message =
    typeof candidate.message === "string" ? candidate.message : status >= 500 ? INTERNAL_ERROR.message : "Bad request";

  return {
    status,
    code,
    message,
    details: isRecord(candidate.details) ? candidate.details : undefined,
    headers: candidate.headers as HeadersInit | undefined,
  };
}

/** Inspects an unknown error and returns a structured HTTP-friendly classification. */
export function classifyError(error: unknown): ClassifiedError {
  const explicit = fromApiError(error as ApiError);
  if (explicit) {
    return explicit;
  }

  const rawMessage = error instanceof Error ? error.message : String(error ?? "");
  const messageLower = rawMessage.toLowerCase();

  if (messageLower.includes("d1_error") || messageLower.includes("sqlite_error")) {
    if (messageLower.includes("constraint") || messageLower.includes("unique")) {
      return {
        status: 409,
        code: "constraint_error",
        message: "Request conflicts with existing data",
      };
    }
    if (messageLower.includes("no such table") || messageLower.includes("no such column")) {
      return {
        status: 500,
        code: "schema_mismatch",
        message: "Database schema is out of date",
      };
    }
  }

  if (messageLower.includes("validation") || messageLower.includes("zod")) {
    return {
      status: 400,
      code: "validation_error",
      message: "Request validation failed",
    };
  }

  if (messageLower.includes("signature") || messageLower.includes("hmac")) {
    return {
      status: 401,
      code: "unauthorized",
      message: "Unauthorized request",
    };
  }

  if (messageLower.includes("forbidden")) {
    return {
      status: 403,
      code: "forbidden",
      message: "Forbidden request",
    };
  }

  if (messageLower.includes("rate limit") || messageLower.includes("too many requests")) {
    return {
      status: 429,
      code: "rate_limited",
      message: "Too many requests",
    };
  }

  return {
    ...INTERNAL_ERROR,
    details: error instanceof Error ? { name: error.name, message: error.message } : undefined,
  };
}
