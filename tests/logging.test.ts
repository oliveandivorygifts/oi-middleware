import { describe, expect, it } from "vitest";
import { redactSensitive, safeJsonStringify, truncateText } from "../src/helpers/logging.js";

describe("redactSensitive", () => {
  it("redacts authorization header", () => {
    expect(redactSensitive({ authorization: "Bearer secret123" })).toEqual({ authorization: "[REDACTED]" });
  });

  it("redacts nested sensitive keys", () => {
    const result = redactSensitive({
      config: { stripe_secret_key: "sk_live_xxx", name: "test" },
    }) as Record<string, unknown>;
    const config = result.config as Record<string, unknown>;
    expect(config.stripe_secret_key).toBe("[REDACTED]");
    expect(config.name).toBe("test");
  });

  it("handles arrays", () => {
    const result = redactSensitive([
      { password: "hunter2", user: "admin" },
      { token: "abc", role: "viewer" },
    ]) as Record<string, unknown>[];
    expect(result[0]?.password).toBe("[REDACTED]");
    expect(result[0]?.user).toBe("admin");
    expect(result[1]?.token).toBe("[REDACTED]");
    expect(result[1]?.role).toBe("viewer");
  });

  it("is case-insensitive on keys", () => {
    expect(redactSensitive({ HMAC_SHARED_SECRET: "s3cret", Cookie: "sess=abc" })).toEqual({
      HMAC_SHARED_SECRET: "[REDACTED]",
      Cookie: "[REDACTED]",
    });
  });

  it("passes through null, undefined, primitives", () => {
    expect(redactSensitive(null)).toBeNull();
    expect(redactSensitive(undefined)).toBeUndefined();
    expect(redactSensitive("hello")).toBe("hello");
    expect(redactSensitive(42)).toBe(42);
  });
});

describe("truncateText", () => {
  it("returns short strings unchanged", () => {
    expect(truncateText("hello", 10)).toBe("hello");
  });

  it("truncates with ellipsis", () => {
    const result = truncateText("abcdefghij", 8);
    expect(result).toBe("abcde...");
    expect(result.length).toBe(8);
  });

  it("handles exact boundary", () => {
    expect(truncateText("12345", 5)).toBe("12345");
  });
});

describe("safeJsonStringify", () => {
  it("redacts and stringifies", () => {
    const result = safeJsonStringify({ api_key: "secret", name: "ok" });
    expect(result).toContain("[REDACTED]");
    expect(result).toContain("ok");
  });

  it("truncates long output", () => {
    const bigObj = { data: "x".repeat(20000) };
    const result = safeJsonStringify(bigObj, 100);
    expect(result.length).toBeLessThanOrEqual(100);
    expect(result).toMatch(/\.\.\.$/);
  });

  it("handles null/undefined", () => {
    expect(safeJsonStringify(null)).toBe("{}");
    expect(safeJsonStringify(undefined)).toBe("{}");
  });
});
