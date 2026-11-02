import { useEffect, useMemo, useState } from "react";
import { DISCLAIMER, HOW_IT_WORKS, PARTNER_CUT_PERCENT, PLANS, formatIllustration, formatMoney, illustrate } from "@shared/program";
import type { PartnerOverview } from "@shared/types";
import { api } from "../api";
import { ErrorNote, useTitle } from "../ui";

export function PartnerHome() {
  const [overview, setOverview] = useState<PartnerOverview | null>(null);
  const [error, setError] = useState("");
  useTitle("Partner program · Driver QR");

  useEffect(() => {
    api<{ overview: PartnerOverview }>("/api/partner/overview")
      .then((data) => setOverview(data.overview))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not load the program."));
  }, []);

  if (!overview) return <p className="muted">{error || "Loading…"}</p>;

  return (
    <div className="partner">
      <p className="eyebrow">Driver QR · Partner program</p>
      <h1>
        Every driver you bring
        <br />
        <em>pays you monthly.</em>
      </h1>
      <p className="lede">Slide to see what the Personal Driver QR program pays you, {overview.displayName}.</p>

      <section className="panel">
        <p className="kicker">Recorded</p>
        <p className="big">{formatMoney(overview.recordedCutCents)}</p>
        <p className="muted">
          Your {overview.cutPercent}% of fees IMagin has recorded. This is a ledger, not a payout and not a promise.
          Recorded fees: {formatMoney(overview.recordedFeeCents)}.
        </p>
        {overview.drivers.length === 0 ? (
          <p>
            No drivers are tracked to you yet. When IMagin assigns a driver and records a Starter fee ({formatMoney(overview.setupCents)}) or a month ({formatMoney(overview.monthlyCents)}), the {overview.cutPercent}% shows up here.
          </p>
        ) : (
          <ul className="ledger">
            {overview.drivers.map((driver) => (
              <li key={driver.id}>
                <div>
                  <b>{driver.firstName}</b>
                  <span className="muted">
                    {driver.city} · {driver.plan} · {driver.active ? "live" : "not live"}
                  </span>
                </div>
                <div className="nums">
                  <span>{formatMoney(driver.feeCents)} recorded</span>
                  <b>{formatMoney(driver.cutCents)}</b>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Calculator />

      <section className="panel">
        <h2>What drivers get</h2>
        <div className="plans">
          <div>
            <b>{PLANS.starter.name}</b>
            <span>{PLANS.starter.detail}</span>
            <em>
              {formatMoney(PLANS.starter.cents)} {PLANS.starter.label}
            </em>
          </div>
          <div>
            <b>{PLANS.monthly.name}</b>
            <span>{PLANS.monthly.detail}</span>
            <em>
              {formatMoney(PLANS.monthly.cents)}/{PLANS.monthly.label}
            </em>
          </div>
        </div>
      </section>

      <section className="panel">
        <h2>How it works</h2>
        <ol className="how">
          {HOW_IT_WORKS.map((step, index) => (
            <li key={step.title}>
              <span>{index + 1}</span>
              <div>
                <b>{step.title}</b>
                <small>{step.detail}</small>
              </div>
            </li>
          ))}
        </ol>
      </section>
      <p className="foot">IMagin · Pompano Beach</p>
      <ErrorNote>{error}</ErrorNote>
    </div>
  );
}

function Calculator() {
  const [drivers, setDrivers] = useState(10);
  const [share, setShare] = useState(80);
  const result = useMemo(() => illustrate(drivers, share / 100), [drivers, share]);
  const max = Math.max(...result.perMonth, 1);
  const picks = [10, 25, 50, 100];

  return (
    <section className="panel calc" aria-labelledby="calc">
      <div className="hero-num">
        <div className="kicker" id="calc">
          Your first year
        </div>
        <div className="big" aria-live="polite">
          {formatIllustration(result.yearTotal)}
        </div>
        <p className="muted">
          {formatIllustration(result.monthlyCut)}/month recurring + {formatIllustration(result.setupCut)} in setup fees
        </p>
      </div>
      <div className="slider-row">
        <div className="drivers">
          <span>Drivers signed up</span>
          <b>{drivers}</b>
        </div>
        <input
          type="range"
          min={1}
          max={200}
          value={drivers}
          aria-label="Number of drivers"
          style={{ ["--p" as string]: `${((drivers - 1) / 199) * 100}%` }}
          onChange={(e) => setDrivers(Number(e.target.value))}
        />
        <div className="chips" role="group" aria-label="Quick picks">
          {picks.map((n) => (
            <button key={n} type="button" className="chip" aria-pressed={drivers === n} onClick={() => setDrivers(n)}>
              {n}
            </button>
          ))}
        </div>
        <label className="pro">
          <span>
            Drivers who stay on the monthly page <b>{share}%</b>
          </span>
          <input
            type="range"
            min={0}
            max={100}
            step={10}
            value={share}
            aria-label="Percent of drivers on the monthly plan"
            style={{ ["--p" as string]: `${share}%` }}
            onChange={(e) => setShare(Number(e.target.value))}
          />
        </label>
      </div>
      <div className="split">
        <div className="mini">
          <span>Your cut</span>
          <b>{PARTNER_CUT_PERCENT}%</b>
        </div>
        <div className="mini">
          <span>After 3 years</span>
          <b className="green">{formatIllustration(result.threeYearTotal)}</b>
        </div>
      </div>
      <div className="chart" aria-hidden="true">
        {result.perMonth.map((value, index) => (
          <span key={index} style={{ height: `${(value / max) * 100}%` }} />
        ))}
      </div>
      <div className="months" aria-hidden="true">
        {result.perMonth.map((_, index) => (
          <span key={index}>{index + 1}</span>
        ))}
      </div>
      <p className="hint">{DISCLAIMER}</p>
      <p className="hint">
        The year total uses the same script as the static partner page, including its assumption that a monthly driver's first month is not counted. That assumption is in the page's script, not in the visible promise.
      </p>
    </section>
  );
}
