import { FormEvent, useEffect, useMemo, useState } from "react";
import { api, type CurrentUser } from "./api";

type Invite = { email: string; displayName: string; expiresAt: string };
type View = "login" | "invite" | "reset" | "home";

function currentRoute(): { view: View; token?: string } {
  const url = new URL(window.location.href);
  const token = new URLSearchParams(url.hash.slice(1)).get("token") ?? url.searchParams.get("token") ?? undefined;
  if (url.pathname === "/accept-invite" || url.pathname === "/reset-password") window.history.replaceState({}, "", url.pathname);
  if (url.pathname === "/accept-invite") return { view: "invite", token };
  if (url.pathname === "/reset-password") return { view: "reset", token };
  return { view: "login" };
}

export function App() {
  const route = useMemo(currentRoute, []);
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    api<{ user: CurrentUser }>("/api/auth/me")
      .then(({ user: nextUser }) => setUser(nextUser))
      .catch(() => setUser(null))
      .finally(() => setChecking(false));
  }, []);

  if (checking) return <CenteredMessage>Preparing your workspace…</CenteredMessage>;
  if (user) return <Home user={user} />;
  if (route.view === "invite") return <AcceptInvite token={route.token} onAccepted={setUser} />;
  if (route.view === "reset") return <ResetPassword token={route.token} />;
  return <Login onLogin={setUser} />;
}

function Shell({ eyebrow, title, children }: { eyebrow: string; title: string; children: React.ReactNode }) {
  return (
    <main className="shell">
      <section className="brand-panel" aria-label="About Team Feedback">
        <div className="mark" aria-hidden="true"><span /><span /><span /></div>
        <div>
          <p className="eyebrow">A healthier feedback rhythm</p>
          <h1>Small signals.<br />Better conversations.</h1>
          <p className="brand-copy">Private, recurring feedback designed to help teams talk honestly and act thoughtfully.</p>
        </div>
        <p className="privacy-note">Survey responses are anonymous to coordinators and teammates.</p>
      </section>
      <section className="form-panel">
        <div className="form-card">
          <p className="eyebrow accent">{eyebrow}</p>
          <h2>{title}</h2>
          {children}
        </div>
      </section>
    </main>
  );
}

function Login({ onLogin }: { onLogin: (user: CurrentUser) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [forgot, setForgot] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true); setError("");
    try {
      const result = await api<{ user: CurrentUser }>("/api/auth/login", {
        method: "POST", body: JSON.stringify({ email, password }),
      });
      onLogin(result.user);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to sign in.");
    } finally { setBusy(false); }
  }

  async function requestReset(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try { await api("/api/auth/password-reset/request", { method: "POST", body: JSON.stringify({ email }) }); setResetSent(true); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to request a reset."); }
    finally { setBusy(false); }
  }

  if (forgot) return (
    <Shell eyebrow="Account recovery" title="Reset your password">
      <form onSubmit={requestReset} className="stack">
        <p className="helper">Enter your work email. If it belongs to an active account, we’ll send a short-lived reset link.</p>
        <Field label="Work email" type="email" value={email} onChange={setEmail} autoComplete="username" />
        {resetSent && <p className="success" role="status">Check your inbox if the account exists.</p>}
        {error && <p className="error" role="alert">{error}</p>}
        <button className="primary" disabled={busy}>{busy ? "Sending…" : "Send reset link"}</button>
        <button type="button" className="text-button align-left" onClick={() => setForgot(false)}>Back to sign in</button>
      </form>
    </Shell>
  );

  return (
    <Shell eyebrow="Welcome back" title="Sign in to continue">
      <form onSubmit={submit} className="stack">
        <Field label="Work email" type="email" value={email} onChange={setEmail} autoComplete="username" />
        <Field label="Password" type="password" value={password} onChange={setPassword} autoComplete="current-password" />
        {error && <p className="error" role="alert">{error}</p>}
        <button className="primary" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
        <button type="button" className="text-button align-left" onClick={() => setForgot(true)}>Forgot your password?</button>
        <p className="helper">Accounts are invitation-only. Ask an administrator if you need access.</p>
      </form>
    </Shell>
  );
}

function ResetPassword({ token }: { token?: string }) {
  const [password, setPassword] = useState(""); const [confirm, setConfirm] = useState("");
  const [error, setError] = useState(token ? "" : "This reset link is incomplete."); const [done, setDone] = useState(false); const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault(); if (!token) return; if (password !== confirm) { setError("The passwords do not match."); return; }
    setBusy(true); setError("");
    try { await api("/api/auth/password-reset/accept", { method: "POST", body: JSON.stringify({ token, password }) }); setDone(true); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to reset your password."); }
    finally { setBusy(false); }
  }
  return <Shell eyebrow="Account recovery" title={done ? "Password updated" : "Choose a new password"}>
    {done ? <div className="stack"><p className="success" role="status">Your other sessions have been signed out.</p><a className="primary link-button" href="/">Return to sign in</a></div> :
      <form onSubmit={submit} className="stack"><Field label="New password" type="password" value={password} onChange={setPassword} autoComplete="new-password" hint="Use at least 15 characters. Passphrases work well." minLength={15} /><Field label="Confirm password" type="password" value={confirm} onChange={setConfirm} autoComplete="new-password" minLength={15} />{error && <p className="error" role="alert">{error}</p>}<button className="primary" disabled={busy || !token}>{busy ? "Updating…" : "Update password"}</button></form>}
  </Shell>;
}

function AcceptInvite({ token, onAccepted }: { token?: string; onAccepted: (user: CurrentUser) => void }) {
  const [invite, setInvite] = useState<Invite | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) { setError("This invitation link is incomplete."); return; }
    api<{ invitation: Invite }>("/api/auth/invitations/resolve", { method: "POST", body: JSON.stringify({ token }) })
      .then(({ invitation }) => setInvite(invitation))
      .catch((caught) => setError(caught instanceof Error ? caught.message : "This invitation is not available."));
  }, [token]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (password !== confirm) { setError("The passwords do not match."); return; }
    if (!token) return;
    setBusy(true); setError("");
    try {
      const result = await api<{ user: CurrentUser }>("/api/auth/invitations/accept", {
        method: "POST", body: JSON.stringify({ token, password }),
      });
      window.history.replaceState({}, "", "/");
      onAccepted(result.user);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to create your account.");
    } finally { setBusy(false); }
  }

  return (
    <Shell eyebrow="You’re invited" title={invite ? `Welcome, ${invite.displayName}` : "Checking your invitation"}>
      {invite && <form onSubmit={submit} className="stack">
        <Field label="Work email" type="email" value={invite.email} readOnly autoComplete="username" />
        <Field label="Create password" type="password" value={password} onChange={setPassword} autoComplete="new-password" hint="Use at least 15 characters. Passphrases work well." minLength={15} />
        <Field label="Confirm password" type="password" value={confirm} onChange={setConfirm} autoComplete="new-password" minLength={15} />
        {error && <p className="error" role="alert">{error}</p>}
        <button className="primary" disabled={busy}>{busy ? "Creating account…" : "Create account"}</button>
      </form>}
      {!invite && <p className={error ? "error" : "helper"} role={error ? "alert" : undefined}>{error || "Validating the secure link…"}</p>}
    </Shell>
  );
}

function Home({ user }: { user: CurrentUser }) {
  async function logout() {
    await api("/api/auth/logout", { method: "POST", body: "{}" }).catch(() => undefined);
    window.location.assign("/");
  }
  return (
    <main className="home">
      <nav><div className="wordmark">Team Feedback</div><button className="text-button" onClick={logout}>Sign out</button></nav>
      <section className="welcome">
        <p className="eyebrow accent">Workspace ready</p>
        <h1>Hello, {user.displayName}</h1>
        <p>Your account is active. Product dashboards will arrive in the next implementation phases.</p>
        <div className="roles" aria-label="Your roles">{user.roles.map((role) => <span key={role}>{role}</span>)}</div>
      </section>
    </main>
  );
}

function Field(props: { label: string; type: string; value: string; onChange?: (value: string) => void; readOnly?: boolean; autoComplete?: string; hint?: string; minLength?: number }) {
  const { label, hint, onChange, ...inputProps } = props;
  const id = label.toLowerCase().replaceAll(" ", "-");
  return <label htmlFor={id}><span>{label}</span><input id={id} {...inputProps} onChange={(event) => onChange?.(event.target.value)} />{hint && <small>{hint}</small>}</label>;
}

function CenteredMessage({ children }: { children: React.ReactNode }) {
  return <main className="centered"><p>{children}</p></main>;
}
