import { afterEach, describe, expect, it, vi } from "vitest";
import { FetchJsonError, fetchJson } from "../src/helpers/fetch-json.js";

function mockFetch(response: Response) {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("FetchJsonError", () => {
  it("has correct properties", () => {
    const err = new FetchJsonError("bad", 422, { ok: false, error: "nope" }, "corr-1", "req-1");
    expect(err.name).toBe("FetchJsonError");
    expect(err.message).toBe("bad");
    expect(err.status).toBe(422);
    expect(err.correlationId).toBe("corr-1");
    expect(err.requestId).toBe("req-1");
    expect(err).toBeInstanceOf(Error);
  });
});

describe("fetchJson", () => {
  it("returns parsed JSON on success", async () => {
    mockFetch(
      new Response(JSON.stringify({ ok: true, data: 42 }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const result = await fetchJson<{ ok: boolean; data: number }>("https://example.com/api");
    expect(result.data).toBe(42);
  });

  it("throws FetchJsonError on non-2xx", async () => {
    mockFetch(
      new Response(
        JSON.stringify({ ok: false, error: { code: "not_found", message: "Gone", correlation_id: "c-1" } }),
        { status: 404 },
      ),
    );
    await expect(fetchJson("https://example.com/api")).rejects.toThrow(FetchJsonError);
  });

  it("throws on network failure with status 0", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));
    try {
      await fetchJson("https://example.com/api");
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(FetchJsonError);
      expect((err as FetchJsonError).status).toBe(0);
    }
  });

  it("throws on { ok: false } even with 200 status", async () => {
    mockFetch(
      new Response(JSON.stringify({ ok: false, error: { code: "logic_error", message: "Nope", correlation_id: "" } }), {
        status: 200,
      }),
    );
    await expect(fetchJson("https://example.com/api")).rejects.toThrow(FetchJsonError);
  });

  it("handles non-JSON error response", async () => {
    mockFetch(
      new Response("Internal Server Error", {
        status: 500,
        headers: { "content-type": "text/plain" },
      }),
    );
    try {
      await fetchJson("https://example.com/api");
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(FetchJsonError);
      expect((err as FetchJsonError).status).toBe(500);
      expect((err as FetchJsonError).message).toContain("non-JSON");
    }
  });

  it("extracts correlation and request IDs from headers", async () => {
    mockFetch(
      new Response(JSON.stringify({ ok: false, error: { code: "err", message: "fail", correlation_id: "" } }), {
        status: 400,
        headers: { "x-correlation-id": "hdr-corr", "x-request-id": "hdr-req" },
      }),
    );
    try {
      await fetchJson("https://example.com/api");
      expect.fail("should have thrown");
    } catch (err) {
      expect((err as FetchJsonError).correlationId).toBe("hdr-corr");
      expect((err as FetchJsonError).requestId).toBe("hdr-req");
    }
  });
});
