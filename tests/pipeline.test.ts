import { describe, expect, it } from "vitest";
import {
  OBSERVABILITY_ACTIONS,
  createHmacSignature,
  runPipeline,
  withAuthHmac,
  withErrorHandling,
  withJsonBody,
} from "../src/index.js";
import type { MiddlewareContext, MiddlewareFunction } from "../src/index.js";

function buildContext(overrides: Partial<MiddlewareContext> = {}): MiddlewareContext {
  return {
    correlation_id: "corr-test",
    request_id: "req-test",
    start_ms: Date.now(),
    ip: "127.0.0.1",
    user_agent: "test-agent",
    route: "/api/test",
    method: "POST",
    env: {},
    state: {},
    ...overrides,
  };
}

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

describe("runPipeline", () => {
  it("executes middleware chain in order", async () => {
    const seen: string[] = [];
    const middlewares: MiddlewareFunction[] = [
      async (_request, _context, next) => {
        seen.push("mw1-before");
        const response = await next();
        seen.push("mw1-after");
        return response;
      },
      async (_request, _context, next) => {
        seen.push("mw2-before");
        const response = await next();
        seen.push("mw2-after");
        return response;
      },
    ];

    const response = await runPipeline(
      new Request("https://example.com/api/test"),
      buildContext(),
      middlewares,
      async () => new Response("ok", { status: 200 }),
    );

    expect(response.status).toBe(200);
    expect(seen).toEqual(["mw1-before", "mw2-before", "mw2-after", "mw1-after"]);
  });

  it("throws when next is called twice", async () => {
    const middlewares: MiddlewareFunction[] = [
      async (_request, _context, next) => {
        await next();
        return next();
      },
    ];

    await expect(
      runPipeline(
        new Request("https://example.com/api/test"),
        buildContext(),
        middlewares,
        async () => new Response("ok", { status: 200 }),
      ),
    ).rejects.toThrow(/next\(\) called multiple times/);
  });
});

describe("withJsonBody", () => {
  it("rejects invalid JSON", async () => {
    const middleware = withJsonBody(1024, true);
    const context = buildContext();
    const request = new Request("https://example.com/api/test", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{invalid json",
    });

    let nextCalled = false;
    const response = await middleware(request, context, async () => {
      nextCalled = true;
      return new Response("ok", { status: 200 });
    });

    expect(nextCalled).toBe(false);
    expect(response.status).toBe(400);
    const payload = (await response.json()) as { error?: { code?: string } };
    expect(payload.error?.code).toBe("bad_request");
  });
});

describe("withErrorHandling", () => {
  it("maps thrown errors to JSON response", async () => {
    const middleware = withErrorHandling();
    const context = buildContext();

    const response = await middleware(new Request("https://example.com/api/test"), context, async () => {
      throw new Error("D1_ERROR: UNIQUE constraint failed: gifts.slug");
    });

    expect(response.status).toBe(409);
    const payload = (await response.json()) as { error?: { code?: string } };
    expect(payload.error?.code).toBe("constraint_error");
    expect(context.state.unhandled_error).toBeInstanceOf(Error);
  });
});

describe("withAuthHmac", () => {
  it("accepts canonical and legacy query signing payloads", async () => {
    const secret = "test-secret";
    const timestamp = String(Math.floor(Date.now() / 1000));
    const nonce = "nonce-123";
    const body = '{"x":1}';
    const requestUrl = "https://example.com/api/test?mode=preview";
    const bodyHash = await sha256Hex(body);

    const canonicalPayload = `POST\n/api/test?mode=preview\n${timestamp}\n${nonce}\n${bodyHash}`;
    const legacyPayload = `POST\n/api/test\n${timestamp}\n${nonce}\n${bodyHash}`;

    const canonicalSignature = await createHmacSignature(secret, canonicalPayload);
    const legacySignature = await createHmacSignature(secret, legacyPayload);

    const middleware = withAuthHmac({
      secret_env_key: "HMAC_SHARED_SECRET",
      replay_protection: false,
    });

    const commonHeaders = {
      "content-type": "application/json",
      "x-oi-timestamp": timestamp,
      "x-oi-nonce": nonce,
    };

    const canonicalResponse = await middleware(
      new Request(requestUrl, {
        method: "POST",
        headers: { ...commonHeaders, "x-oi-signature": canonicalSignature },
        body,
      }),
      buildContext({ env: { HMAC_SHARED_SECRET: secret }, state: {} }),
      async () => new Response("ok", { status: 200 }),
    );
    expect(canonicalResponse.status).toBe(200);

    const legacyContext = buildContext({ env: { HMAC_SHARED_SECRET: secret }, state: {} });
    const legacyResponse = await middleware(
      new Request(requestUrl, {
        method: "POST",
        headers: { ...commonHeaders, "x-oi-signature": legacySignature },
        body,
      }),
      legacyContext,
      async () => new Response("ok", { status: 200 }),
    );
    expect(legacyResponse.status).toBe(200);
    expect(legacyContext.state.auth_action).toBe(OBSERVABILITY_ACTIONS.AUTH_HMAC_OK);

    const invalidContext = buildContext({ env: { HMAC_SHARED_SECRET: secret }, state: {} });
    const invalidResponse = await middleware(
      new Request(requestUrl, {
        method: "POST",
        headers: { ...commonHeaders, "x-oi-signature": "invalid" },
        body,
      }),
      invalidContext,
      async () => new Response("ok", { status: 200 }),
    );
    expect(invalidResponse.status).toBe(401);
    const invalidPayload = (await invalidResponse.json()) as { error?: { code?: string } };
    expect(invalidPayload.error?.code).toBe("unauthorized");
    expect(invalidContext.state.auth_action).toBe(OBSERVABILITY_ACTIONS.AUTH_HMAC_FAIL);
  });
});
