import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { formatMoney } from "@shared/program";
import type { PublicRequest } from "@shared/types";
import { api } from "../api";
import { fill, rideWhen, smsHref } from "../format";
import { Glyph, Wheel } from "../icons";
import { ErrorNote, useTitle } from "../ui";

export function Status() {
  const { slug = "", code = "" } = useParams();
  const [request, setRequest] = useState<PublicRequest | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const data = await api<{ request: PublicRequest }>(`/api/public/requests/${code}`);
      if (data.request.driverSlug !== slug) {
        setError("Request not found.");
        return;
      }
      setRequest(data.request);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request not found.");
    }
  }

  useEffect(() => {
    void load();
  }, [slug, code]);

  useTitle(
    request ? `Request sent · ${request.driverFirstName} · Your Personal Driver` : "Request · Your Personal Driver",
  );

  async function act(path: "confirm" | "cancel") {
    setBusy(true);
    setError("");
    try {
      const data = await api<{ request: PublicRequest }>(`/api/public/requests/${code}/${path}`, { method: "POST" });
      setRequest(data.request);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update the request.");
    } finally {
      setBusy(false);
    }
  }

  if (!request && !error) {
    return (
      <div className="book">
        <p className="boot">Loading…</p>
      </div>
    );
  }
  if (!request) {
    return (
      <div className="book">
        <main className="hero">
          <div className="wrap hero-inner">
            <Wheel />
            <h1 className="name">Request</h1>
            <ErrorNote>{error}</ErrorNote>
            <Link className="btn btn-ghost" to={`/d/${slug}`}>
              Back to booking page
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const smsBody = fill(request.smsMessage, { firstName: request.driverFirstName, city: request.city });

  return (
    <div className="book" style={{ ["--gold" as string]: request.accent }}>
      <main className="hero thanks">
        <div className="road" aria-hidden="true">
          <div className="road-plane">
            <span className="road-dash" />
          </div>
        </div>
        <div className="wrap hero-inner">
          <Wheel />
          <p className="eyebrow">{request.status === "requested" ? "Request sent" : request.status === "confirmed" ? "Confirmed" : "Request"}</p>
          <h1 className="name">{request.status === "confirmed" ? "You're confirmed." : "Thank you."}</h1>
          {request.status === "requested" && (
            <p className="lede">{request.driverFirstName} will text you to confirm the price and pickup time.</p>
          )}
          {request.status === "quoted" && (
            <p className="lede">The price is ready. Nothing is booked until you confirm.</p>
          )}
          {request.status === "confirmed" && (
            <p className="lede">You confirmed this ride. No payment is collected here.</p>
          )}
          {request.status === "declined" && <p className="lede">This request was declined. Nothing was booked.</p>}
          {request.status === "cancelled" && <p className="lede">This request is cancelled. Nothing was booked.</p>}
          {request.status !== "confirmed" && request.status !== "declined" && request.status !== "cancelled" && (
            <p className="note">Nothing is booked until you confirm.</p>
          )}
          <div className="rule" />
          <div className="card status-card">
            <p>
              <Glyph name="road" /> {request.pickup} → {request.dropoff}
            </p>
            <p>{rideWhen(request.rideDate, request.quotedPickupTime || request.rideTime)}</p>
            <p>Passengers: {request.passengers}</p>
            {request.notes && <p>Notes: {request.notes}</p>}
            {request.quoteAmountCents != null && (
              <p className="quote">
                Driver-entered price: <b>{formatMoney(request.quoteAmountCents)}</b>
              </p>
            )}
            {request.quoteNote && <p>{request.quoteNote}</p>}
            {request.quoteAmountCents != null && (
              <p className="hint">Not a published rate. The current pages have no price list. The driver enters what they would have texted.</p>
            )}
            <ErrorNote>{error}</ErrorNote>
            {request.status === "quoted" && (
              <button className="btn btn-gold" type="button" disabled={busy} onClick={() => void act("confirm")}>
                {busy ? "Saving…" : "Confirm this ride"}
              </button>
            )}
            {(request.status === "requested" || request.status === "quoted") && (
              <button className="btn btn-ghost" type="button" disabled={busy} onClick={() => void act("cancel")}>
                Cancel this request
              </button>
            )}
          </div>
          <div className="actions">
            <a className="btn btn-outline" href={`/api/public/drivers/${request.driverSlug}/vcard`}>
              Save {request.driverFirstName} to contacts
            </a>
            {request.sms && (
              <a className="btn btn-outline" href={smsHref(request.sms, smsBody)}>
                Text {request.driverFirstName}
              </a>
            )}
            <Link className="btn btn-ghost" to={`/d/${request.driverSlug}`}>
              Back to booking page
            </Link>
          </div>
        </div>
      </main>
      <footer className="footer">
        <div className="wrap">
          Booking pages by IMagin · Want one? <a href="https://imaginhq.com">imaginhq.com</a>
        </div>
      </footer>
    </div>
  );
}
