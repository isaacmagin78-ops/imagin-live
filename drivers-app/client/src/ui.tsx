import type { ReactNode } from "react";
import { NavLink, Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import type { RequestStatus } from "@shared/types";
import { api } from "./api";
import { useAuth } from "./auth";
import { Wheel } from "./icons";

const STATUS_LABEL: Record<RequestStatus, string> = {
  requested: "Requested",
  quoted: "Price ready",
  confirmed: "Confirmed",
  declined: "Declined",
  cancelled: "Cancelled",
};

export function StatusPill({ status }: { status: RequestStatus }) {
  return <span className={`pill pill-${status}`}>{STATUS_LABEL[status]}</span>;
}

export function ErrorNote({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <p className="error" role="alert">
      {children}
    </p>
  );
}

export function RequireAuth() {
  const { user, ready } = useAuth();
  if (!ready) return <p className="boot">Loading…</p>;
  if (!user) return <Navigate to="/" replace />;
  return <Outlet />;
}

export function Role({ role, children }: { role: "admin" | "partner" | "driver"; children: ReactNode }) {
  const { user, ready } = useAuth();
  if (!ready) return <p className="muted">Loading…</p>;
  if (!user) return <Navigate to="/" replace />;
  if (user.role !== role) return <Navigate to="/app" replace />;
  return children;
}

export function HomeRedirect() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/" replace />;
  if (user.role === "admin") return <Navigate to="/app/admin" replace />;
  if (user.role === "partner") return <Navigate to="/app/partner" replace />;
  return <Navigate to="/app/requests" replace />;
}

export function Shell() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const wide = location.pathname.startsWith("/app/admin");
  if (!user) return <Navigate to="/" replace />;

  async function signOut() {
    await api("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    setUser(null);
    navigate("/");
  }

  const tabs =
    user.role === "admin"
      ? [
          ["/app/admin", "Overview"],
          ["/app/admin/drivers", "Drivers"],
          ["/app/admin/requests", "Requests"],
          ["/app/admin/outbox", "Outbox"],
        ]
      : user.role === "partner"
        ? [["/app/partner", "Program"]]
        : [
            ["/app/requests", "Requests"],
            ["/app/profile", "Profile"],
            ["/app/card", "QR card"],
          ];

  return (
    <div className="shell">
      <header className="top">
        <div className="brand">
          <Wheel />
          <div>
            <b>Driver QR</b>
            <span>
              {user.displayName} · {user.role}
            </span>
          </div>
        </div>
        <button className="texty" type="button" onClick={() => void signOut()}>
          Sign out
        </button>
      </header>
      <main className={wide ? "wide" : ""}>
        <Outlet />
      </main>
      <nav className="tabbar" aria-label="Sections">
        {tabs.map(([to, label]) => (
          <NavLink key={to} to={to} end={to === "/app/admin"}>
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

export function useTitle(title: string) {
  if (typeof document !== "undefined") document.title = title;
}
