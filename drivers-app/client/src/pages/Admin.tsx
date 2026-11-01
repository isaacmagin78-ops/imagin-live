import { useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { MONTHLY_CENTS, SETUP_CENTS, formatMoney } from "@shared/program";
import type { DriverProfile, FeeEvent, NotificationRow, Plan, RideRequest } from "@shared/types";
import { api } from "../api";
import { rideWhen } from "../format";
import { ErrorNote, StatusPill, useTitle } from "../ui";

type PartnerOpt = { id: string; displayName: string; email: string };
type Counts = { drivers: number; live: number; partners: number; requests: number; notifications: number };

export function AdminHome() {
  const [counts, setCounts] = useState<Counts | null>(null);
  const [byStatus, setByStatus] = useState<{ status: string; n: number }[]>([]);
  const [partners, setPartners] = useState<PartnerOpt[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  useTitle("Admin · Driver QR");

  function load() {
    api<{ counts: Counts; byStatus: { status: string; n: number }[]; partners: PartnerOpt[] }>("/api/admin/overview")
      .then((data) => {
        setCounts(data.counts);
        setByStatus(data.byStatus);
        setPartners(data.partners);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not load."));
  }

  useEffect(load, []);

  async function addPartner(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError("");
    setNotice("");
    try {
      await api("/api/admin/partners", {
        method: "POST",
        body: JSON.stringify({
          displayName: String(form.get("displayName") || ""),
          email: String(form.get("email") || ""),
          password: String(form.get("password") || ""),
        }),
      });
      event.currentTarget.reset();
      setNotice("Partner login created. Share the password yourself. This app does not email it.");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add the partner.");
    }
  }

  return (
    <div>
      <p className="eyebrow">IMagin</p>
      <h1>Overview</h1>
      <p className="lede">Replaces copying a folder, editing config.js, and reading the shared lead inbox for this program.</p>
      {counts && (
        <div className="stats">
          <Stat k="Drivers" v={String(counts.drivers)} />
          <Stat k="Live pages" v={String(counts.live)} />
          <Stat k="Requests" v={String(counts.requests)} />
          <Stat k="Outbox" v={String(counts.notifications)} />
        </div>
      )}
      {byStatus.length > 0 && (
        <p className="muted">
          {byStatus.map((row) => `${row.status} ${row.n}`).join(" · ")}
        </p>
      )}
      <section className="panel">
        <h2>Partners</h2>
        <ul className="plain">
          {partners.map((partner) => (
            <li key={partner.id}>
              <b>{partner.displayName}</b> <span className="muted">{partner.email}</span>
            </li>
          ))}
        </ul>
        <form onSubmit={addPartner}>
          <div className="row2">
            <label>
              First name
              <input name="displayName" required placeholder="Sean" />
            </label>
            <label>
              Email
              <input name="email" type="email" required />
            </label>
          </div>
          <label>
            Temporary password
            <input name="password" type="text" minLength={8} required autoComplete="new-password" />
          </label>
          <ErrorNote>{error}</ErrorNote>
          {notice && <p className="ok">{notice}</p>}
          <button className="btn btn-gold" type="submit">
            Add partner
          </button>
        </form>
      </section>
    </div>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div className="mini">
      <span>{k}</span>
      <b>{v}</b>
    </div>
  );
}

export function AdminDrivers() {
  const [drivers, setDrivers] = useState<DriverProfile[]>([]);
  const [partners, setPartners] = useState<PartnerOpt[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  useTitle("Drivers · Driver QR");

  function load() {
    api<{ drivers: DriverProfile[]; partners: PartnerOpt[] }>("/api/admin/drivers")
      .then((data) => {
        setDrivers(data.drivers);
        setPartners(data.partners);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not load drivers."));
  }
  useEffect(load, []);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError("");
    setNotice("");
    try {
      const data = await api<{ profile: DriverProfile }>("/api/admin/drivers", {
        method: "POST",
        body: JSON.stringify({
          firstName: String(form.get("firstName") || ""),
          slug: String(form.get("slug") || ""),
          city: String(form.get("city") || ""),
          email: String(form.get("email") || ""),
          password: String(form.get("password") || ""),
          partnerId: String(form.get("partnerId") || "") || null,
          plan: String(form.get("plan") || "none"),
          active: form.get("active") === "on",
        }),
      });
      event.currentTarget.reset();
      setNotice(`Created ${data.profile.firstName}. Share the password yourself. The page is ${data.profile.active ? "live" : "not live"}.`);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the driver.");
    }
  }

  return (
    <div>
      <p className="eyebrow">Onboarding</p>
      <h1>Drivers</h1>
      <p className="lede">Creating a driver replaces copying ride/sean and hand-editing config.js. Service titles start from that template. Airport detail stays blank until someone sets it.</p>
      <form className="panel" onSubmit={create}>
        <div className="row2">
          <label>
            First name
            <input name="firstName" required />
          </label>
          <label>
            Slug
            <input name="slug" required placeholder="first-name" pattern="[a-z0-9]+(-[a-z0-9]+)*" />
          </label>
        </div>
        <label>
          City
          <input name="city" required placeholder="Where the page says they drive" />
        </label>
        <div className="row2">
          <label>
            Login email
            <input name="email" type="email" required />
          </label>
          <label>
            Temporary password
            <input name="password" type="text" minLength={8} required autoComplete="new-password" />
          </label>
        </div>
        <div className="row2">
          <label>
            Partner
            <select name="partnerId" defaultValue="">
              <option value="">None</option>
              {partners.map((partner) => (
                <option key={partner.id} value={partner.id}>
                  {partner.displayName}
                </option>
              ))}
            </select>
          </label>
          <label>
            Plan label
            <select name="plan" defaultValue="none">
              <option value="none">None recorded</option>
              <option value="starter">Starter</option>
              <option value="monthly">Monthly</option>
            </select>
          </label>
        </div>
        <label className="check">
          <input name="active" type="checkbox" />
          <span>Page is live</span>
        </label>
        <ErrorNote>{error}</ErrorNote>
        {notice && <p className="ok">{notice}</p>}
        <button className="btn btn-gold" type="submit">
          Create driver
        </button>
      </form>
      <div className="stack">
        {drivers.map((driver) => (
          <Link className="req" key={driver.id} to={`/app/admin/drivers/${driver.id}`}>
            <div className="req-top">
              <b>{driver.firstName}</b>
              <span className="pill">{driver.active ? "Live" : "Not live"}</span>
            </div>
            <span className="muted">
              /d/{driver.slug} · {driver.city} · {driver.plan}
              {driver.partnerName ? ` · partner ${driver.partnerName}` : " · no partner"}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function AdminDriver() {
  const { id = "" } = useParams();
  const [profile, setProfile] = useState<DriverProfile | null>(null);
  const [fees, setFees] = useState<FeeEvent[]>([]);
  const [partners, setPartners] = useState<PartnerOpt[]>([]);
  const [plan, setPlan] = useState<Plan>("none");
  const [partnerId, setPartnerId] = useState("");
  const [active, setActive] = useState(false);
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");
  useTitle("Driver · Driver QR");

  function load() {
    api<{ profile: DriverProfile; fees: FeeEvent[]; partners: PartnerOpt[] }>(`/api/admin/drivers/${id}`)
      .then((data) => {
        setProfile(data.profile);
        setFees(data.fees);
        setPartners(data.partners);
        setPlan(data.profile.plan);
        setPartnerId(data.profile.partnerId || "");
        setActive(data.profile.active);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Driver not found."));
  }
  useEffect(load, [id]);

  async function save(event: FormEvent) {
    event.preventDefault();
    setError("");
    setWarning("");
    try {
      const data = await api<{ profile: DriverProfile }>(`/api/admin/drivers/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ partnerId: partnerId || null, plan, active }),
      });
      setProfile(data.profile);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    }
  }

  async function fee(kind: "setup" | "monthly") {
    setError("");
    setWarning("");
    try {
      const data = await api<{ warning: string | null }>(`/api/admin/drivers/${id}/fees`, {
        method: "POST",
        body: JSON.stringify({ kind }),
      });
      setWarning(data.warning || "Recorded. Nothing was charged.");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not record the fee.");
    }
  }

  if (!profile) return <p className="muted">{error || "Loading…"}</p>;

  return (
    <div>
      <p className="eyebrow">/d/{profile.slug}</p>
      <h1>{profile.firstName}</h1>
      <p className="lede">
        {profile.city}. <a href={profile.bookingUrl}>Booking page</a>
      </p>
      {profile.sourceNote && <p className="muted">{profile.sourceNote}</p>}
      <form className="panel" onSubmit={save}>
        <label>
          Partner
          <select value={partnerId} onChange={(e) => setPartnerId(e.target.value)}>
            <option value="">None</option>
            {partners.map((partner) => (
              <option key={partner.id} value={partner.id}>
                {partner.displayName}
              </option>
            ))}
          </select>
        </label>
        <label>
          Plan label
          <select value={plan} onChange={(e) => setPlan(e.target.value as Plan)}>
            <option value="none">None recorded</option>
            <option value="starter">Starter · {formatMoney(SETUP_CENTS)} once</option>
            <option value="monthly">Monthly · {formatMoney(MONTHLY_CENTS)}/mo</option>
          </select>
        </label>
        <label className="check">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
          <span>Page is live</span>
        </label>
        <p className="hint">The plan label does not record a fee and does not charge anyone.</p>
        <button className="btn btn-gold" type="submit">
          Save
        </button>
      </form>
      <section className="panel">
        <h2>Ledger</h2>
        <p className="muted">Prices are the ones printed on the partner page. Recording writes the notebook line. Nothing is sent to a payment provider.</p>
        <div className="row2">
          <button className="btn btn-outline" type="button" onClick={() => void fee("setup")}>
            Record setup {formatMoney(SETUP_CENTS)}
          </button>
          <button className="btn btn-outline" type="button" onClick={() => void fee("monthly")}>
            Record month {formatMoney(MONTHLY_CENTS)}
          </button>
        </div>
        <ErrorNote>{error}</ErrorNote>
        {warning && <p className="ok">{warning}</p>}
        <ul className="ledger">
          {fees.map((feeRow) => (
            <li key={feeRow.id}>
              <div>
                <b>{feeRow.kind}</b>
                <span className="muted">{new Date(feeRow.recordedAt).toLocaleString()}</span>
              </div>
              <div className="nums">
                <span>{formatMoney(feeRow.amountCents)}</span>
                <b>{formatMoney(feeRow.partnerCutCents)} cut</b>
              </div>
            </li>
          ))}
          {fees.length === 0 && <li>Nothing recorded.</li>}
        </ul>
      </section>
    </div>
  );
}

export function AdminRequests() {
  const [requests, setRequests] = useState<RideRequest[] | null>(null);
  const [error, setError] = useState("");
  useTitle("Requests · Driver QR");
  useEffect(() => {
    api<{ requests: RideRequest[] }>("/api/admin/requests")
      .then((data) => setRequests(data.requests))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not load requests."));
  }, []);
  return (
    <div>
      <p className="eyebrow">Intake</p>
      <h1>Requests</h1>
      <p className="lede">These used to land in the shared IMagin lead inbox. They stay in this app's database.</p>
      <ErrorNote>{error}</ErrorNote>
      <div className="stack">
        {requests?.map((request) => (
          <article className="req" key={request.id}>
            <div className="req-top">
              <b>
                {request.riderName} · {request.driverFirstName}
              </b>
              <StatusPill status={request.status} />
            </div>
            <span className="muted">{rideWhen(request.rideDate, request.rideTime)}</span>
            <span>
              {request.pickup} → {request.dropoff}
            </span>
            <span className="muted">{request.riderMobile}</span>
            {request.quoteAmountCents != null && <span>Driver-entered {formatMoney(request.quoteAmountCents)}</span>}
          </article>
        ))}
      </div>
    </div>
  );
}

export function AdminOutbox() {
  const [rows, setRows] = useState<NotificationRow[] | null>(null);
  const [error, setError] = useState("");
  useTitle("Outbox · Driver QR");
  useEffect(() => {
    api<{ notifications: NotificationRow[] }>("/api/admin/notifications")
      .then((data) => setRows(data.notifications))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not load the outbox."));
  }, []);
  return (
    <div>
      <p className="eyebrow">Not sent</p>
      <h1>Outbox</h1>
      <p className="lede">Drafts for the texts the driver used to send by hand. The default mode writes them here and does not deliver them.</p>
      <ErrorNote>{error}</ErrorNote>
      <div className="stack">
        {rows?.map((row) => (
          <article className="panel" key={row.id}>
            <div className="req-top">
              <b>{row.kind}</b>
              <span className="pill">{row.status}</span>
            </div>
            <p className="muted">To {row.toAddress}</p>
            <p className="hint">{row.detail}</p>
            <pre>{row.body}</pre>
          </article>
        ))}
        {rows && rows.length === 0 && <p>No drafts yet.</p>}
      </div>
    </div>
  );
}
