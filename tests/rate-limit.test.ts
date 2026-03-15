import { describe, expect, it } from "vitest";
import {
  classifyError,
  getHeaderCaseInsensitive,
  getRetryAfterSeconds,
  getWindowStartSeconds,
  resolveRequestIds,
  withRateLimit,
} from "../src/index.js";

describe("resolveRequestIds", () => {
  it("prefers x-correlation-id and falls back to cf-ray", () => {
    const request = new Request("https://example.com", {
      headers: {
        "X-Correlation-Id": "corr-1",
        "CF-Ray": "ray-1",
      },
    });

    const ids = resolveRequestIds(request, null, () => "generated-id");
    expect(ids.correlation_id).toBe("corr-1");
    expect(ids.request_id).toBe("ray-1");
    expect(getHeaderCaseInsensitive(request.headers, "x-correlation-id")).toBe("corr-1");
  });
});

describe("classifyError", () => {
  it("maps D1 unique constraint to 409", () => {
    const classified = classifyError(new Error("D1_ERROR: UNIQUE constraint failed: gifts.slug"));
    expect(classified.status).toBe(409);
    expect(classified.code).toBe("constraint_error");
  });
});

describe("rate limit window helpers", () => {
  it("returns stable bucket and retry-after", () => {
    const nowMilliseconds = 1710000123456;
    const windowSeconds = 60;
    const windowStart = getWindowStartSeconds(nowMilliseconds, windowSeconds);
    expect(windowStart).toBe(1710000120);

    const retryAfter = getRetryAfterSeconds(nowMilliseconds, windowStart, windowSeconds);
    expect(retryAfter).toBeGreaterThanOrEqual(1);
    expect(retryAfter).toBeLessThanOrEqual(windowSeconds);
  });
});

describe("withRateLimit", () => {
  it("returns 429 with retry-after header in memory mode", async () => {
    const middleware = withRateLimit({
      limit: 1,
      window_seconds: 60,
      key_fn: () => "ip-test-rate-limit",
      mode: "memory",
    });

    const request = new Request("https://example.com/api/test");
    const context = {
      correlation_id: "corr-1",
      request_id: "req-1",
      start_ms: Date.now(),
      ip: "1.1.1.1",
      user_agent: null,
      route: "/api/test",
      method: "GET",
      env: {},
      state: {},
    };

    const firstResponse = await middleware(request, context, async () => new Response("ok"));
    expect(firstResponse.status).toBe(200);

    const secondResponse = await middleware(request, context, async () => new Response("ok"));
    expect(secondResponse.status).toBe(429);
    expect(secondResponse.headers.get("retry-after")).toBeTruthy();
  });
});
