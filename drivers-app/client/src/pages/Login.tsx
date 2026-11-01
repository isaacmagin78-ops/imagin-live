import { useState, type FormEvent } from "react";
import { Link, Navigate } from "react-router-dom";
import type { SessionUser } from "@shared/types";
import { api } from "../api";
import { useAuth } from "../auth";
import { Wheel } from "../icons";
import { ErrorNote, useTitle } from "../ui";

export function Login({ missing = false }: { missing?: boolean }) {
  const { user, ready, setUser } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useTitle(missing ? "Not found · Driver QR" : "Sign in · Driver QR");

  if (ready && user && !missing) return <Navigate to="/app" replace />;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const data = await api<{ user: SessionUser }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      setUser(data.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth">
      <Wheel />
      <p className="eyebrow">IMagin · Pompano Beach</p>
      <h1>{missing ? "That page is not here." : "Driver QR"}</h1>
      <p className="lede">
        {missing
          ? "The partner page on the static site is still at /drivers/. This app is separate."
          : "Sign in if you are IMagin, a partner, or a driver. Riders use a booking link and do not need an account."}
      </p>
      {!missing && (
        <form className="panel" onSubmit={onSubmit}>
          <label>
            Email
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="username" required />
          </label>
          <label>
            Password
            <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" autoComplete="current-password" required />
          </label>
          <ErrorNote>{error}</ErrorNote>
          <button className="btn btn-gold" type="submit" disabled={busy} aria-busy={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
      )}
      <p className="fine">
        Seeded booking page: <Link to="/d/sean">/d/sean</Link>
      </p>
      <details className="seed-note">
        <summary>Local seed logins (placeholders)</summary>
        <p>Password for all three: <code>seed-local-only</code>. These are not real accounts.</p>
        <ul>
          <li><code>admin@example.com</code> — IMagin</li>
          <li><code>sean.partner@example.com</code> — partner named on the static page</li>
          <li><code>sean.driver@example.com</code> — driver from ride/sean</li>
        </ul>
      </details>
    </div>
  );
}
