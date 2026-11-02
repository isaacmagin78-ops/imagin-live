import { useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { SERVICE_ICONS, type ServiceInput } from "@shared/defaults";
import { formatMoney } from "@shared/program";
import type { DriverProfile, NotificationRow, RideRequest } from "@shared/types";
import { api } from "../api";
import { rideWhen } from "../format";
import { ErrorNote, StatusPill, useTitle } from "../ui";

export function DriverHome() {
  const [requests, setRequests] = useState<RideRequest[] | null>(null);
  const [profile, setProfile] = useState<DriverProfile | null>(null);
  const [error, setError] = useState("");
  useTitle("Requests · Driver QR");

  useEffect(() => {
    Promise.all([
      api<{ requests: RideRequest[] }>("/api/driver/requests"),
      api<{ profile: DriverProfile }>("/api/driver/profile"),
    ])
      .then(([list, prof]) => {
        setRequests(list.requests);
        setProfile(prof.profile);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not load requests."));
  }, []);

  return (
    <div>
      <p className="eyebrow">Driver</p>
      <h1>{profile ? profile.firstName : "Requests"}</h1>
      {profile && (
        <p className="lede">
          {profile.active ? "Booking page is live." : "Booking page is not live."} Plan recorded by IMagin: {profile.plan}.{" "}
          <Link to={`/d/${profile.slug}`}>Open the page</Link>
        </p>
      )}
      <ErrorNote>{error}</ErrorNote>
      {!requests && !error && <p className="muted">Loading…</p>}
      {requests && requests.length === 0 && (
        <div className="panel">
          <p>No ride requests yet. When a rider uses your booking page, the request shows up here.</p>
        </div>
      )}
      <div className="stack">
        {requests?.map((request) => (
          <Link className="req" key={request.id} to={`/app/requests/${request.id}`}>
            <div className="req-top">
              <b>{request.riderName}</b>
              <StatusPill status={request.status} />
            </div>
            <span className="muted">{rideWhen(request.rideDate, request.rideTime)}</span>
            <span>
              {request.pickup} → {request.dropoff}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function DriverRequest() {
  const { id = "" } = useParams();
  const [request, setRequest] = useState<RideRequest | null>(null);
  const [notes, setNotes] = useState<NotificationRow[]>([]);
  const [amount, setAmount] = useState("");
  const [pickupTime, setPickupTime] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  useTitle("Request · Driver QR");

  function apply(next: RideRequest, notifications: NotificationRow[]) {
    setRequest(next);
    setNotes(notifications);
    setPickupTime(next.quotedPickupTime || next.rideTime);
    if (next.quoteAmountCents != null) setAmount((next.quoteAmountCents / 100).toFixed(2));
  }

  useEffect(() => {
    api<{ request: RideRequest; notifications: NotificationRow[] }>(`/api/driver/requests/${id}`)
      .then((data) => apply(data.request, data.notifications))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Request not found."));
  }, [id]);

  async function quote(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const data = await api<{ request: RideRequest; notifications: NotificationRow[] }>(`/api/driver/requests/${id}/quote`, {
        method: "POST",
        body: JSON.stringify({ amount, pickupTime, note }),
      });
      apply(data.request, data.notifications);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the quote.");
    } finally {
      setBusy(false);
    }
  }

  async function decline() {
    setBusy(true);
    setError("");
    try {
      const data = await api<{ request: RideRequest }>(`/api/driver/requests/${id}/decline`, { method: "POST" });
      setRequest(data.request);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not decline.");
    } finally {
      setBusy(false);
    }
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  if (!request) return <p className="muted">{error || "Loading…"}</p>;
  const open = request.status === "requested" || request.status === "quoted";
  const draft = notes.find((row) => row.kind === "quote_ready" || row.kind === "quote_updated");

  return (
    <div>
      <p className="eyebrow">Ride request</p>
      <div className="req-top">
        <h1>{request.riderName}</h1>
        <StatusPill status={request.status} />
      </div>
      <div className="panel">
        <p>
          <b>Mobile</b> {request.riderMobile}
        </p>
        <p>
          {request.pickup} → {request.dropoff}
        </p>
        <p>{rideWhen(request.rideDate, request.rideTime)}</p>
        <p>Passengers: {request.passengers}</p>
        <p>Notes: {request.notes || "none"}</p>
        {request.quoteAmountCents != null && <p>Saved price: {formatMoney(request.quoteAmountCents)}</p>}
      </div>
      {open && (
        <form className="panel" onSubmit={quote}>
          <h2>Price to text</h2>
          <p className="muted">There is no rate card on the current pages. Enter the amount you would have texted. Saving writes a draft. Nothing is sent.</p>
          <label>
            Amount
            <input inputMode="decimal" placeholder="Amount you would text" value={amount} onChange={(e) => setAmount(e.target.value)} required />
          </label>
          <label>
            Pickup time
            <input type="time" value={pickupTime} onChange={(e) => setPickupTime(e.target.value)} required />
          </label>
          <label>
            Note to the rider <span className="opt">(optional)</span>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="Anything you would add to the text" />
          </label>
          <ErrorNote>{error}</ErrorNote>
          <button className="btn btn-gold" disabled={busy} type="submit">
            {busy ? "Saving…" : "Save quote"}
          </button>
          <button className="btn btn-ghost" disabled={busy} type="button" onClick={() => void decline()}>
            Decline request
          </button>
        </form>
      )}
      {!open && <ErrorNote>{error}</ErrorNote>}
      {draft && (
        <div className="panel">
          <h2>Draft text</h2>
          <p className="muted">{draft.detail}</p>
          <pre>{draft.body}</pre>
          <button className="btn btn-outline" type="button" onClick={() => void copy(draft.body)}>
            {copied ? "Copied" : "Copy draft"}
          </button>
        </div>
      )}
      <p>
        <Link to="/app/requests">All requests</Link>
      </p>
    </div>
  );
}

export function DriverProfile() {
  const [profile, setProfile] = useState<DriverProfile | null>(null);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  useTitle("Profile · Driver QR");

  useEffect(() => {
    api<{ profile: DriverProfile }>("/api/driver/profile")
      .then((data) => setProfile(data.profile))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not load the profile."));
  }, []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!profile) return;
    setBusy(true);
    setSaved(false);
    setError("");
    try {
      const data = await api<{ profile: DriverProfile }>("/api/driver/profile", {
        method: "PUT",
        body: JSON.stringify(profile),
      });
      setProfile(data.profile);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  if (!profile) return <p className="muted">{error || "Loading…"}</p>;

  function patch(partial: Partial<DriverProfile>) {
    setProfile({ ...profile!, ...partial });
  }

  function patchService(index: number, partial: Partial<ServiceInput>) {
    const services = profile!.services.map((service, i) => (i === index ? { ...service, ...partial } : service));
    patch({ services });
  }

  return (
    <form onSubmit={onSubmit}>
      <p className="eyebrow">Page setup</p>
      <h1>Profile</h1>
      <p className="lede">These are the fields that used to live in config.js. The static ride/sean page is not changed by saving here.</p>
      {profile.sourceNote && <p className="muted">{profile.sourceNote}</p>}
      <div className="panel">
        <label>
          First name
          <input value={profile.firstName} onChange={(e) => patch({ firstName: e.target.value })} required />
        </label>
        <p className="hint">First name only, never a last name.</p>
        <label>
          City
          <input value={profile.city} onChange={(e) => patch({ city: e.target.value })} required />
        </label>
        <label>
          Accent
          <input value={profile.accent} onChange={(e) => patch({ accent: e.target.value })} pattern="#[0-9A-Fa-f]{6}" required />
        </label>
        <label>
          Most passengers
          <input type="number" min={1} max={12} value={profile.maxPassengers} onChange={(e) => patch({ maxPassengers: Number(e.target.value) })} required />
        </label>
        <label>
          Text the rider would send
          <textarea value={profile.smsMessage} onChange={(e) => patch({ smsMessage: e.target.value })} rows={3} required />
        </label>
        <label>
          Mobile
          <input value={profile.sms} onChange={(e) => patch({ sms: e.target.value })} placeholder="+1…" inputMode="tel" />
        </label>
        <label className="check">
          <input type="checkbox" checked={profile.smsPublish} onChange={(e) => patch({ smsPublish: e.target.checked })} />
          <span>Publish this number on the booking page. Leave off until the driver has agreed in writing.</span>
        </label>
      </div>
      <div className="panel">
        <h2>Services</h2>
        {profile.services.map((service, index) => (
          <div className="service-edit" key={index}>
            <select value={service.icon} onChange={(e) => patchService(index, { icon: e.target.value as ServiceInput["icon"] })}>
              {SERVICE_ICONS.map((icon) => (
                <option key={icon} value={icon}>
                  {icon}
                </option>
              ))}
            </select>
            <input value={service.title} onChange={(e) => patchService(index, { title: e.target.value })} aria-label="Service title" />
            <input value={service.detail} onChange={(e) => patchService(index, { detail: e.target.value })} aria-label="Service detail" placeholder="Detail" />
            <button
              type="button"
              className="texty"
              onClick={() => patch({ services: profile.services.filter((_, i) => i !== index) })}
              disabled={profile.services.length === 1}
            >
              Remove
            </button>
          </div>
        ))}
        <button type="button" className="btn btn-outline" onClick={() => patch({ services: [...profile.services, { icon: "star", title: "", detail: "" }] })}>
          Add a service
        </button>
      </div>
      <div className="panel">
        <h2>Trust lines</h2>
        <p className="hint">Keep these honest. Never claim licensing, insurance, or certification.</p>
        {profile.trust.map((line, index) => (
          <label key={index}>
            Line {index + 1}
            <input
              value={line}
              onChange={(e) => patch({ trust: profile.trust.map((item, i) => (i === index ? e.target.value : item)) })}
            />
          </label>
        ))}
      </div>
      <ErrorNote>{error}</ErrorNote>
      {saved && <p className="ok">Saved.</p>}
      <button className="btn btn-gold" disabled={busy} type="submit">
        {busy ? "Saving…" : "Save profile"}
      </button>
    </form>
  );
}

export function DriverCard() {
  const [profile, setProfile] = useState<DriverProfile | null>(null);
  useTitle("QR card · Driver QR");
  useEffect(() => {
    api<{ profile: DriverProfile }>("/api/driver/profile")
      .then((data) => setProfile(data.profile))
      .catch(() => setProfile(null));
  }, []);
  if (!profile) return <p className="muted">Loading…</p>;
  return (
    <div>
      <p className="eyebrow">Starter</p>
      <h1>QR card</h1>
      <p className="lede">Starter on the partner page is a booking page plus a print-ready QR card. This is that card. Printing stays in your browser.</p>
      <p className="muted">The QR file at the site root, drivers-qr.png, still opens the static partner page. This code opens the booking page.</p>
      <button className="btn btn-gold" type="button" onClick={() => window.print()}>
        Print card
      </button>
      <article className="print-card">
        <p className="eyebrow">Private · On Call</p>
        <h2>{profile.firstName}</h2>
        <p>Your personal driver in {profile.city}</p>
        <img src={`/api/public/drivers/${profile.slug}/qr.svg`} alt={`QR code for ${profile.firstName}'s booking page`} width={220} height={220} />
        <p className="tagline">Same driver. Every time.</p>
        <p>Request a ride</p>
        <p className="url">{profile.bookingUrl}</p>
      </article>
      {!profile.active && <p className="error">This page is not live yet, so a scan will not open a booking form.</p>}
    </div>
  );
}
