import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import type { PublicDriver } from "@shared/types";
import { ApiError, api } from "../api";
import { fill, smsHref, todayLocal } from "../format";
import { Arrow, Glyph, Wheel } from "../icons";
import { ErrorNote, useTitle } from "../ui";

export function Book() {
  const { slug = "" } = useParams();
  const navigate = useNavigate();
  const [driver, setDriver] = useState<PublicDriver | null>(null);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let gone = false;
    api<{ driver: PublicDriver }>(`/api/public/drivers/${slug}`)
      .then((data) => {
        if (!gone) setDriver(data.driver);
      })
      .catch((err: unknown) => {
        if (gone) return;
        setMissing(true);
        setError(err instanceof Error ? err.message : "This booking page was not found.");
      });
    return () => {
      gone = true;
    };
  }, [slug]);

  useTitle(driver ? `${driver.firstName} · Your Personal Driver` : "Your Personal Driver");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!driver) return;
    setBusy(true);
    setFormError("");
    const form = new FormData(event.currentTarget);
    const payload = {
      name: String(form.get("name") || ""),
      mobile: String(form.get("mobile") || ""),
      pickup: String(form.get("pickup") || ""),
      dropoff: String(form.get("dropoff") || ""),
      date: String(form.get("date") || ""),
      time: String(form.get("time") || ""),
      passengers: Number(form.get("passengers") || 1),
      notes: String(form.get("notes") || ""),
      company: String(form.get("company") || ""),
    };
    try {
      const result = await api<{ ok: boolean; code?: string }>(`/api/public/drivers/${driver.slug}/requests`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      if (result.code) navigate(`/d/${driver.slug}/r/${result.code}`);
      else setFormError("That request was not saved.");
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Could not send the request.");
    } finally {
      setBusy(false);
    }
  }

  if (missing) {
    return (
      <div className="book">
        <main className="hero">
          <div className="wrap hero-inner">
            <Wheel />
            <p className="eyebrow">Private · On Call</p>
            <h1 className="name">Not live</h1>
            <p className="lede">{error}</p>
            <p className="note">The static page at ride/sean/ is unchanged.</p>
          </div>
        </main>
      </div>
    );
  }

  if (!driver) {
    return (
      <div className="book">
        <p className="boot">Loading…</p>
      </div>
    );
  }

  const values = { firstName: driver.firstName, city: driver.city };
  const smsBody = fill(driver.smsMessage, values);

  return (
    <div className="book" style={{ ["--gold" as string]: driver.accent }}>
      <header className="hero">
        <div className="road" aria-hidden="true">
          <div className="road-plane">
            <span className="road-dash" />
          </div>
        </div>
        <div className="wrap hero-inner">
          <Wheel />
          <p className="eyebrow">
            Private<span className="sep">·</span>On Call
          </p>
          <h1 className="name">{driver.firstName}</h1>
          <p className="lede">Your personal driver in {driver.city}</p>
          <div className="rule" aria-hidden="true" />
          <p className="tagline">Same driver. Every time.</p>
          <div className="actions">
            <a className="btn btn-gold" href="#book">
              Request a ride <Arrow />
            </a>
            {driver.sms && (
              <a className="btn btn-outline" href={smsHref(driver.sms, smsBody)}>
                Text {driver.firstName}
              </a>
            )}
            <a className="btn btn-ghost" href={`/api/public/drivers/${driver.slug}/vcard`}>
              Save {driver.firstName} to contacts
            </a>
          </div>
        </div>
      </header>

      <section className="section">
        <div className="wrap">
          <p className="kicker">On call for</p>
          <h2>Wherever the day takes you</h2>
          <ul className="chips" aria-label="Services">
            {driver.services.map((service) => (
              <li className="chip" key={`${service.icon}-${service.title}`}>
                <Glyph name={service.icon} />
                <span className="chip-t">{service.title}</span>
                {service.detail && <span className="chip-d">{service.detail}</span>}
              </li>
            ))}
          </ul>
          {driver.trust.length > 0 && (
            <ul className="trust">
              {driver.trust.map((line) => (
                <li key={line}>
                  <Glyph name="check" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="section" id="book">
        <div className="wrap">
          <p className="kicker">Book ahead</p>
          <h2>Request your next ride</h2>
          <p className="sub">
            Tell {driver.firstName} where and when. You'll get a text to confirm the price before anything is booked.
          </p>
          <ol className="steps">
            <li>
              <span className="steps-n">1</span>
              <div>
                <strong>Send your request</strong>
                <span>Pickup, drop-off, date and time.</span>
              </div>
            </li>
            <li>
              <span className="steps-n">2</span>
              <div>
                <strong>{driver.firstName} texts you back</strong>
                <span>Your price and pickup time, by text.</span>
              </div>
            </li>
            <li>
              <span className="steps-n">3</span>
              <div>
                <strong>Reply to confirm</strong>
                <span>Nothing is booked until you do. You can confirm on the next page.</span>
              </div>
            </li>
          </ol>
          <form className="card" onSubmit={onSubmit}>
            <p className="hp" aria-hidden="true">
              <label>
                Leave this field empty
                <input name="company" tabIndex={-1} autoComplete="off" />
              </label>
            </p>
            <div className="field">
              <label htmlFor="f-name">Your name</label>
              <input id="f-name" name="name" autoComplete="name" placeholder="First and last name" required />
            </div>
            <div className="field">
              <label htmlFor="f-mobile">Mobile</label>
              <input id="f-mobile" name="mobile" type="tel" inputMode="tel" autoComplete="tel" placeholder="Your mobile number" required />
              <p className="hint">{driver.firstName} will text this number to confirm.</p>
            </div>
            <div className="field">
              <label htmlFor="f-pickup">Pickup</label>
              <input id="f-pickup" name="pickup" autoComplete="street-address" placeholder="Address, hotel or terminal" required />
            </div>
            <div className="field">
              <label htmlFor="f-dropoff">Drop-off</label>
              <input id="f-dropoff" name="dropoff" placeholder="Address, venue or airport" required />
            </div>
            <div className="row2">
              <div className="field">
                <label htmlFor="f-date">Date</label>
                <input id="f-date" name="date" type="date" min={todayLocal()} required />
              </div>
              <div className="field">
                <label htmlFor="f-time">Pickup time</label>
                <input id="f-time" name="time" type="time" step={300} required />
              </div>
            </div>
            <div className="field">
              <label htmlFor="f-passengers">Passengers</label>
              <select id="f-passengers" name="passengers" defaultValue="1" required>
                {Array.from({ length: driver.maxPassengers }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="f-notes">
                Notes <span className="opt">(optional)</span>
              </label>
              <textarea id="f-notes" name="notes" rows={3} placeholder="Flight number, luggage, extra stops, return trip" />
            </div>
            <ErrorNote>{formError}</ErrorNote>
            <button className="btn btn-gold" type="submit" disabled={busy} aria-busy={busy}>
              <span>{busy ? "Sending…" : "Send request"}</span>
              <Arrow />
            </button>
            <p className="fineprint">No payment now. Nothing is booked until you confirm.</p>
          </form>
        </div>
      </section>
      <footer className="footer">
        <div className="wrap">
          Booking pages by IMagin · Want one? <a href="https://imaginhq.com">imaginhq.com</a>
          <span> · </span>
          <Link to="/">Staff sign in</Link>
        </div>
      </footer>
    </div>
  );
}
