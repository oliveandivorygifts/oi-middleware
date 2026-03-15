export interface RequestIds {
  correlation_id: string;
  request_id: string;
}

export function getHeaderCaseInsensitive(headers: Headers, name: string): string | null {
  const targetName = name.toLowerCase();
  for (const [headerName, headerValue] of headers.entries()) {
    if (headerName.toLowerCase() === targetName) {
      return headerValue;
    }
  }
  return null;
}

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
