/**
 * Request identity resolution helpers.
 * Extracts or generates correlation and request IDs from incoming headers
 * so every log and error response can be traced back to a single request.
 *
 * @module
 */

/** Pair of IDs that uniquely identify a request for tracing. */
export interface RequestIds {
  correlation_id: string;
  request_id: string;
}

/** Reads a header value regardless of casing, for environments where Headers may be case-sensitive. */
export function getHeaderCaseInsensitive(headers: Headers, name: string): string | null {
  const targetName = name.toLowerCase();
  for (const [headerName, headerValue] of headers.entries()) {
    if (headerName.toLowerCase() === targetName) {
      return headerValue;
    }
  }
  return null;
}

/** Extracts or generates correlation_id and request_id from request headers. */
export function resolveRequestIds(
  requestOrHeaders: Request | Headers,
  fallbackCfRay?: string | null,
  generateId: () => string = () => crypto.randomUUID(),
): RequestIds {
  const headers = requestOrHeaders instanceof Headers ? requestOrHeaders : requestOrHeaders.headers;
  const incomingCorrelationId =
    getHeaderCaseInsensitive(headers, "x-correlation-id") || getHeaderCaseInsensitive(headers, "correlation-id");

  const cfRay = getHeaderCaseInsensitive(headers, "cf-ray") || fallbackCfRay || null;
  const generatedRequestId = generateId();

  return {
    correlation_id: incomingCorrelationId || generatedRequestId,
    request_id: cfRay || generatedRequestId,
  };
}
