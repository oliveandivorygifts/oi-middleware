import { describe, expect, it } from "vitest";
import { attachRequestHeaders, jsonError, jsonOk, noContent, redirect } from "../src/helpers/json-error.js";

describe("jsonOk", () => {
  it("returns 200 with JSON body", async () => {
    const res = jsonOk({ items: [1, 2] });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/json");
    const body = (await res.json()) as { items: number[] };
    expect(body.items).toEqual([1, 2]);
  });

  it("accepts a custom status code", () => {
    const res = jsonOk({ created: true }, 201);
    expect(res.status).toBe(201);
  });

  it("attaches request headers from context", () => {
    const res = jsonOk({ ok: true }, 200, { correlation_id: "c-1", request_id: "r-1" });
    expect(res.headers.get("x-correlation-id")).toBe("c-1");
    expect(res.headers.get("x-request-id")).toBe("r-1");
  });
});

describe("jsonError", () => {
  it("returns structured error body", async () => {
    const res = jsonError({ status: 422, code: "validation_error", message: "Bad input" });
    expect(res.status).toBe(422);
    const body = (await res.json()) as { ok: boolean; error: { code: string; message: string } };
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("validation_error");
    expect(body.error.message).toBe("Bad input");
  });

  it("merges custom headers", () => {
    const res = jsonError({
      status: 429,
      code: "rate_limited",
      message: "Too many requests",
      headers: { "retry-after": "30" },
    });
    expect(res.headers.get("retry-after")).toBe("30");
    expect(res.headers.get("content-type")).toBe("application/json");
  });

  it("uses correlation_id from error over context", async () => {
    const res = jsonError(
      { status: 500, code: "internal", message: "fail", correlation_id: "err-corr" },
      { correlation_id: "ctx-corr", request_id: "r-1" },
    );
    const body = (await res.json()) as { error: { correlation_id: string } };
    expect(body.error.correlation_id).toBe("err-corr");
    expect(res.headers.get("x-correlation-id")).toBe("err-corr");
    expect(res.headers.get("x-request-id")).toBe("r-1");
  });
});

describe("noContent", () => {
  it("returns 204 with no body", async () => {
    const res = noContent();
    expect(res.status).toBe(204);
    expect(await res.text()).toBe("");
  });
});

describe("redirect", () => {
  it("returns 302 with location header", () => {
    const res = redirect("https://example.com/done");
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("https://example.com/done");
  });

  it("accepts custom status", () => {
    const res = redirect("https://example.com", 301);
    expect(res.status).toBe(301);
  });
});

describe("attachRequestHeaders", () => {
  it("is a no-op without context", () => {
    const res = new Response("ok");
    attachRequestHeaders(res);
    expect(res.headers.get("x-correlation-id")).toBeNull();
    expect(res.headers.get("x-request-id")).toBeNull();
  });
});
