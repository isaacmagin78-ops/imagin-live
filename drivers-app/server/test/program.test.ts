import { describe, expect, it } from "vitest";
import { dollarsToCents, illustrate, partnerCutCents, SETUP_CENTS, MONTHLY_CENTS } from "../../shared/program.ts";

describe("partner page illustration", () => {
  it("matches the script in drivers/index.html for 10 drivers at 80%", () => {
    const result = illustrate(10, 0.8);
    expect(result.setupCut).toBeCloseTo(396, 5);
    expect(result.monthlyCut).toBeCloseTo(48, 5);
    expect(result.yearTotal).toBeCloseTo(660, 5);
    expect(result.threeYearTotal).toBeCloseTo(1812, 5);
    expect(result.perMonth[0]).toBeCloseTo(33, 5);
    expect(result.perMonth[1]).toBeCloseTo(37, 5);
    expect(result.perMonth[11]).toBeCloseTo(77, 5);
    const sum = result.perMonth.reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(result.yearTotal, 5);
  });

  it("uses the printed prices for the ledger cut", () => {
    expect(partnerCutCents(SETUP_CENTS)).toBe(3960);
    expect(partnerCutCents(MONTHLY_CENTS)).toBe(600);
  });

  it("does not invent a price from an empty quote", () => {
    expect(dollarsToCents("")).toBeNull();
    expect(dollarsToCents("0")).toBeNull();
    expect(dollarsToCents("12.345")).toBeNull();
    expect(dollarsToCents("123.45")).toBe(12345);
  });
});
