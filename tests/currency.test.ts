import { describe, expect, it } from "vitest";
import { formatCurrency } from "../src/helpers/currency.js";

describe("formatCurrency", () => {
  it("formats cents to AUD dollars", () => {
    expect(formatCurrency(1234)).toBe("$12.34");
  });

  it("handles zero", () => {
    expect(formatCurrency(0)).toBe("$0.00");
  });

  it("handles null and undefined", () => {
    expect(formatCurrency(null)).toBe("$0.00");
    expect(formatCurrency(undefined)).toBe("$0.00");
  });

  it("handles sub-dollar amounts", () => {
    expect(formatCurrency(99)).toBe("$0.99");
    expect(formatCurrency(1)).toBe("$0.01");
  });

  it("handles large amounts", () => {
    const result = formatCurrency(1_500_000);
    expect(result).toMatch(/15[,.]?000\.00/);
  });
});
