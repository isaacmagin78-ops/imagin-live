/** Prices, cut, and the year chart from drivers/index.html.
 *  The chart is the page's illustration, not a promise and not a ledger.
 *  The original script assumes a monthly driver's first month is not counted.
 *  That assumption is not written on the page; the page only says the chart
 *  is an illustration. The ledger elsewhere uses the printed $99 and $15 only
 *  when an admin records a fee. It does not apply the first-month assumption.
 */

export const SETUP_CENTS = 9900;
export const MONTHLY_CENTS = 1500;
export const PARTNER_CUT = 0.4;
export const PARTNER_CUT_BPS = 4000;
export const PARTNER_CUT_PERCENT = 40;

export const PRICE_SOURCE = "drivers/index.html";

export const DISCLAIMER =
  "Months 1–12, assuming you add the same number of drivers evenly over the year and they stay. Illustration, not a promise.";

export const PLANS = {
  starter: {
    name: "Starter",
    detail: "Their own booking page + print-ready QR card",
    cents: SETUP_CENTS,
    label: "once",
  },
  monthly: {
    name: "Monthly",
    detail: "Page stays live, updates included. Riders book the same driver again.",
    cents: MONTHLY_CENTS,
    label: "mo",
  },
} as const;

export const HOW_IT_WORKS = [
  {
    title: "You meet drivers",
    detail: "At the chargers, the airport lot, wherever they wait.",
  },
  {
    title: "IMagin builds their page + QR",
    detail: "Done in a day. Riders scan, book the same driver again.",
  },
  {
    title: "You get 40%",
    detail: "Of every setup and every month they stay. Tracked per driver.",
  },
] as const;

export type Illustration = {
  drivers: number;
  monthlyShare: number;
  setupCut: number;
  monthlyCut: number;
  yearTotal: number;
  threeYearTotal: number;
  perMonth: number[];
};

/** Same arithmetic as the script in drivers/index.html. Amounts are dollars, not cents. */
export function illustrate(driverCount: number, monthlyShare: number): Illustration {
  const n = clamp(driverCount, 1, 200);
  const pro = clamp(monthlyShare, 0, 1);
  const SETUP = SETUP_CENTS / 100;
  const MONTHLY = MONTHLY_CENTS / 100;
  const CUT = PARTNER_CUT;
  const setupCut = n * SETUP * CUT;
  const monthlyCut = n * pro * MONTHLY * CUT;
  const perMonth: number[] = [];
  let yearTotal = setupCut;
  for (let m = 1; m <= 12; m++) {
    const paying = Math.max(0, (n * (m - 1)) / 12) * pro;
    perMonth.push(paying * MONTHLY * CUT + (n / 12) * SETUP * CUT);
    yearTotal += paying * MONTHLY * CUT;
  }
  return {
    drivers: n,
    monthlyShare: pro,
    setupCut,
    monthlyCut,
    yearTotal,
    threeYearTotal: yearTotal + monthlyCut * 24,
    perMonth,
  };
}

export function partnerCutCents(amountCents: number): number {
  return Math.round((amountCents * PARTNER_CUT_BPS) / 10000);
}

export function formatMoney(cents: number): string {
  const whole = cents % 100 === 0;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: whole ? 0 : 2,
  }).format(cents / 100);
}

/** Whole dollars, matching the calculator on drivers/index.html. */
export function formatIllustration(dollars: number): string {
  return "$" + Math.round(dollars).toLocaleString("en-US");
}

export function dollarsToCents(input: string): number | null {
  const s = input.trim().replace(/^\$/, "");
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const [d, frac = ""] = s.split(".");
  const cents = Number(d) * 100 + Number((frac + "00").slice(0, 2));
  if (!Number.isSafeInteger(cents) || cents <= 0 || cents > 1_000_000_00) return null;
  return cents;
}

function clamp(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}
