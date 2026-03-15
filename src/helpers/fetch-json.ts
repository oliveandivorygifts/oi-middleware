export interface ApiErrorPayload {
  ok?: boolean;
  error?:
    | {
        code?: string;
        message?: string;
        correlation_id?: string;
      }
    | string;
  message?: string;
  missing?: string[];
  correlation_id?: string;
  details?: unknown;
}

export class FetchJsonError extends Error {
  status: number;
  payload?: ApiErrorPayload;
  correlationId: string;
  requestId: string;

  constructor(message: string, status: number, payload?: ApiErrorPayload, correlationId = "", requestId = "") {
    super(message);
    this.name = "FetchJsonError";
    this.status = status;
    this.payload = payload;
    this.correlationId = correlationId;
    this.requestId = requestId;
  }
}

function extractErrorDetails(payload: ApiErrorPayload | undefined, responseCorrelationId: string) {
  if (!payload) return { message: "", correlationId: responseCorrelationId, code: "" };

  let message = payload.message || "";
  let correlationId = payload.correlation_id || responseCorrelationId;
  let code = "";

  if (typeof payload.error === "object" && payload.error !== null) {
    message = payload.error.message || message || "";
    correlationId = payload.error.correlation_id || correlationId;
    code = payload.error.code || "";
  } else if (typeof payload.error === "string") {
    message = message || payload.error;
  }

  return { message, correlationId, code };
}

/**
 * Shared wrapper around the native `fetch` API that throws `FetchJsonError`
 * on non-2xx responses or when the middleware returns `{ ok: false }`.
 */
export async function fetchJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(input, init);
  } catch {
    throw new FetchJsonError("Network request failed. Please try again.", 0);
  }

  const responseCorrelationId = response.headers.get("x-correlation-id") || "";
  const responseRequestId = response.headers.get("x-request-id") || "";

  let rawText = "";
  try {
    rawText = await response.text();
  } catch {
    // Ignore text reading errors
  }

  let payload: ApiErrorPayload | undefined;
  if (rawText.trim()) {
    try {
      payload = JSON.parse(rawText) as ApiErrorPayload;
    } catch {
      payload = undefined;
    }
  }

  if (!payload && rawText.trim().length > 0 && !response.ok) {
    const ref = responseCorrelationId || responseRequestId;
    const suffix = ref ? ` Ref: ${ref}` : "";
    const contentType = response.headers.get("content-type") || "unknown";
    const excerpt = rawText.trim().slice(0, 200);
    throw new FetchJsonError(
      `Unexpected non-JSON response from API (${response.status}, ${contentType}). ${excerpt}${suffix}`,
      response.status,
      undefined,
      responseCorrelationId,
      responseRequestId,
    );
  }

  const hasStructuredError =
    payload !== undefined &&
    typeof payload === "object" &&
    !Array.isArray(payload) &&
    "ok" in payload &&
    payload.ok === false;

  if (!response.ok || hasStructuredError) {
    const details = extractErrorDetails(payload, responseCorrelationId);
    const missing = Array.isArray(payload?.missing) ? payload?.missing.join(", ") : "";
    const baseMessage = details.message || (missing ? `Missing: ${missing}` : `Request failed (${response.status}).`);

    let message = "";
    if (details.code) message += `${details.code}: `;
    message += baseMessage;

    const ref = responseRequestId || details.correlationId;
    if (ref && !message.includes(ref)) {
      message += ` Ref: ${ref}`;
    }

    throw new FetchJsonError(message, response.status, payload, details.correlationId, responseRequestId);
  }

  return (payload as T) || ({} as T);
}
