import { type FormEvent, type ReactNode, useEffect, useId, useState } from "react";
import { api, type CurrentUser } from "./api";
import { useLocale } from "./i18n";
import { SiteHeader } from "./components/SiteHeader";

function currentRoute() {
  const url = new URL(window.location.href);
  const token = new URLSearchParams(url.hash.slice(1)).get("token") ?? url.searchParams.get("token") ?? undefined;
  const view = url.pathname === "/accept-invite" ? "invite" : url.pathname === "/reset-password" ? "reset" : "login";
  if (view !== "login") {
    url.hash = "";
    url.searchParams.delete("token");
    window.history.replaceState({}, "", url.pathname + url.search);
  }
  return { view, token };
}
const route = currentRoute();
type Invite = { email: string; displayName: string; expiresAt: string };

export function App() {
  const { t, locale } = useLocale();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [checking, setChecking] = useState(true);
  const [logoutError, setLogoutError] = useState("");

  useEffect(() => {
    api<{ user: CurrentUser }>("/api/auth/me")
      .then(({ user: nextUser }) => setUser(nextUser))
      .catch(() => setUser(null))
      .finally(() => setChecking(false));
  }, []);

  async function logout() {
    try {
      await api("/api/auth/logout", { method: "POST", body: "{}" });
      window.location.assign(`/?lang=${locale}`);
    } catch {
      setLogoutError("Something went wrong. Please try again.");
    }
  }

  return (
    <div className="page-shell">
      <a className="skip-link" href="#main-content">{t("Skip to content")}</a>
      <SiteHeader signedIn={Boolean(user)} onSignOut={logout} />
      {checking ? (
        <main id="main-content" className="centered"><p role="status">{t("Preparing your workspace…")}</p></main>
      ) : user ? (
        <Home user={user} error={logoutError} />
      ) : route.view === "invite" ? (
        <AcceptInvite token={route.token} onAccepted={setUser} />
      ) : route.view === "reset" ? (
        <ResetPassword token={route.token} />
      ) : (
        <Login onLogin={setUser} />
      )}
      <footer className="site-footer" id="privacy" tabIndex={-1}>
        <div className="site-footer__inner page-width">
          <p>{t("Feedback, with care.")}</p>
          <p className="privacy-note"><span className="shell-icon" aria-hidden="true" />{t("Survey responses are anonymous to coordinators and teammates.")}</p>
        </div>
      </footer>
    </div>
  );
}

function Shell({ eyebrow, title, children }: { eyebrow: string; title: string; children: ReactNode }) {
  const { t } = useLocale();
  return (
    <main id="main-content" className="shell page-width">
      <section className="brand-panel" aria-label={t("About Team Feedback")}>
        <p className="availability"><span className="availability__dot" aria-hidden="true" />{t("A healthier feedback rhythm")}</p>
        <div className="brand-title">
          <h1><span>{t("Small signals.")}</span><span>{t("Better conversations.")}</span></h1>
          <span className="brand-shape" aria-hidden="true" />
        </div>
        <p className="brand-copy">{t("Private, recurring feedback designed to help teams talk honestly and act thoughtfully.")}</p>
      </section>
      <section className="form-panel" aria-labelledby="form-title">
        <div className="form-card">
          <p className="eyebrow">{eyebrow}</p>
          <h2 id="form-title">{title}</h2>
          {children}
        </div>
      </section>
    </main>
  );
}

function Primary({ busy, disabled, children }: { busy?: boolean; disabled?: boolean; children: ReactNode }) {
  return (
    <button className="case-link primary" disabled={busy || disabled} aria-busy={busy}>
      <span>{children}</span><span className="case-link__icon" aria-hidden="true" />
    </button>
  );
}

function ErrorMessage({ message }: { message: string }) {
  const { t } = useLocale();
  return message ? <p className="error" role="alert">{t(message)}</p> : null;
}

function errorText(caught: unknown, fallback: string) {
  return caught instanceof Error ? caught.message : fallback;
}

function Login({ onLogin }: { onLogin: (user: CurrentUser) => void }) {
  const { t } = useLocale();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [forgot, setForgot] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (forgot) {
        await api("/api/auth/password-reset/request", { method: "POST", body: JSON.stringify({ email }) });
        setResetSent(true);
      } else {
        const result = await api<{ user: CurrentUser }>("/api/auth/login", {
          method: "POST",
          body: JSON.stringify({ email, password }),
        });
        onLogin(result.user);
      }
    } catch (caught) {
      setError(errorText(caught, forgot ? "Unable to request a reset." : "Unable to sign in."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell eyebrow={t(forgot ? "Account recovery" : "Welcome back")} title={t(forgot ? "Reset your password" : "Sign in to continue")}>
      <form onSubmit={submit} className="stack">
        {forgot && <p className="helper">{t("Enter your work email. If it belongs to an active account, we’ll send a short-lived reset link.")}</p>}
        <Field label={t("Work email")} type="email" value={email} onChange={setEmail} autoComplete="username" />
        {!forgot && <Field label={t("Password")} type="password" value={password} onChange={setPassword} autoComplete="current-password" />}
        {forgot && resetSent && <p className="success" role="status">{t("Check your inbox if the account exists.")}</p>}
        <ErrorMessage message={error} />
        <Primary busy={busy}>{t(forgot ? (busy ? "Sending…" : "Send reset link") : (busy ? "Signing in…" : "Sign in"))}</Primary>
        <button type="button" className="text-button align-left" onClick={() => { setForgot(!forgot); setError(""); }}>
          {t(forgot ? "Back to sign in" : "Forgot your password?")}
        </button>
        {!forgot && <p className="helper">{t("Accounts are invitation-only. Ask an administrator if you need access.")}</p>}
      </form>
    </Shell>
  );
}

function ResetPassword({ token }: { token?: string }) {
  const { t, locale } = useLocale();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState(token ? "" : "This reset link is incomplete.");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!token) return;
    if (password !== confirm) {
      setError("The passwords do not match.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await api("/api/auth/password-reset/accept", { method: "POST", body: JSON.stringify({ token, password }) });
      setDone(true);
    } catch (caught) {
      setError(errorText(caught, "Unable to reset your password."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell eyebrow={t("Account recovery")} title={t(done ? "Password updated" : "Choose a new password")}>
      {done ? (
        <div className="stack">
          <p className="success" role="status">{t("Your other sessions have been signed out.")}</p>
          <a className="case-link" href={`/?lang=${locale}`}>{t("Return to sign in")}<span className="case-link__icon" aria-hidden="true" /></a>
        </div>
      ) : (
        <form onSubmit={submit} className="stack">
          <Field label={t("New password")} type="password" value={password} onChange={setPassword} autoComplete="new-password" hint={t("Use at least 15 characters. Passphrases work well.")} minLength={15} />
          <Field label={t("Confirm password")} type="password" value={confirm} onChange={setConfirm} autoComplete="new-password" minLength={15} />
          <ErrorMessage message={error} />
          <Primary busy={busy} disabled={!token}>{t(busy ? "Updating…" : "Update password")}</Primary>
        </form>
      )}
    </Shell>
  );
}

function AcceptInvite({ token, onAccepted }: { token?: string; onAccepted: (user: CurrentUser) => void }) {
  const { t, locale } = useLocale();
  const [invite, setInvite] = useState<Invite | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) {
      setError("This invitation link is incomplete.");
      return;
    }
    api<{ invitation: Invite }>("/api/auth/invitations/resolve", { method: "POST", body: JSON.stringify({ token }) })
      .then(({ invitation }) => setInvite(invitation))
      .catch((caught) => setError(errorText(caught, "This invitation is not available.")));
  }, [token]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (password !== confirm) {
      setError("The passwords do not match.");
      return;
    }
    if (!token) return;
    setBusy(true);
    setError("");
    try {
      const result = await api<{ user: CurrentUser }>("/api/auth/invitations/accept", {
        method: "POST",
        body: JSON.stringify({ token, password }),
      });
      window.history.replaceState({}, "", `/?lang=${locale}`);
      onAccepted(result.user);
    } catch (caught) {
      setError(errorText(caught, "Unable to create your account."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell eyebrow={t("You’re invited")} title={invite ? t("Welcome, {name}", { name: invite.displayName }) : t("Checking your invitation")}>
      {invite ? (
        <form onSubmit={submit} className="stack">
          <Field label={t("Work email")} type="email" value={invite.email} readOnly autoComplete="username" />
          <Field label={t("Create password")} type="password" value={password} onChange={setPassword} autoComplete="new-password" hint={t("Use at least 15 characters. Passphrases work well.")} minLength={15} />
          <Field label={t("Confirm password")} type="password" value={confirm} onChange={setConfirm} autoComplete="new-password" minLength={15} />
          <ErrorMessage message={error} />
          <Primary busy={busy}>{t(busy ? "Creating account…" : "Create account")}</Primary>
        </form>
      ) : error ? (
        <ErrorMessage message={error} />
      ) : (
        <p className="helper" role="status">{t("Validating the secure link…")}</p>
      )}
    </Shell>
  );
}

function Home({ user, error }: { user: CurrentUser; error: string }) {
  if (user.roles.includes("employee")) return <EmployeeHome user={user} logoutError={error} />;
  const { t } = useLocale();
  return (
    <main id="main-content" className="home page-width">
      <section className="welcome">
        <p className="availability"><span className="availability__dot" aria-hidden="true" />{t("Workspace ready")}</p>
        <h1>{t("Hello, {name}", { name: user.displayName })}<span className="welcome-shell shell-icon" aria-hidden="true" /></h1>
        <p className="welcome-copy">{t("Your account is active. Product dashboards will arrive in the next implementation phases.")}</p>
        <div className="roles" aria-label={t("Your roles")}>{user.roles.map((role) => <span key={role}>{t(role)}</span>)}</div>
        <ErrorMessage message={error} />
      </section>
    </main>
  );
}

type EmployeeDashboardData = {
  activeCycle: null | { id: string; opensAt: string; closesAt: string; teamName: string; coordinatorName: string };
  history: Array<{ cycleId: string; opensAt: string; status: "done" | "skipped" }>;
};

function EmployeeHome({ user, logoutError }: { user: CurrentUser; logoutError: string }) {
  const { t, locale } = useLocale();
  const [dashboard, setDashboard] = useState<EmployeeDashboardData | null>(null);
  const [loadError, setLoadError] = useState("");
  const [surveyOpen, setSurveyOpen] = useState(false);
  const [ratings, setRatings] = useState({ coordinator: 0, team: 0, work: 0 });
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function loadDashboard() {
    try {
      setDashboard(await api<EmployeeDashboardData>("/api/employee/dashboard"));
      setLoadError("");
    } catch (caught) {
      setLoadError(errorText(caught, "Unable to load your feedback space."));
    }
  }

  useEffect(() => { void loadDashboard(); }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!dashboard?.activeCycle) return;
    setBusy(true);
    setLoadError("");
    try {
      await api("/api/employee/feedback", {
        method: "POST",
        body: JSON.stringify({ cycleId: dashboard.activeCycle.id, ...ratings, comment }),
      });
      setSubmitted(true);
      setSurveyOpen(false);
      await loadDashboard();
    } catch (caught) {
      setLoadError(errorText(caught, "Unable to send your feedback."));
    } finally {
      setBusy(false);
    }
  }

  const date = (value: string, options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(locale === "en" ? "en-US" : "pt-BR", {
    timeZone: "America/Fortaleza", ...options,
  }).format(new Date(value));
  const firstName = user.displayName.trim().split(/\s+/)[0];

  return (
    <main id="main-content" className="employee-dashboard page-width">
      <section className="employee-hero">
        <p className="availability"><span className="availability__dot" aria-hidden="true" />{t(dashboard?.activeCycle ? "Feedback open today" : "Your feedback space")}</p>
        <h1>{t("Hello, {name}", { name: firstName })}</h1>
        <p>{t("A few honest minutes today can make the next conversation better.")}</p>
      </section>

      <div className="employee-layout">
        <section className="active-feedback" aria-labelledby="active-feedback-title">
          {submitted && <p className="success" role="status">{t("Feedback sent. Thank you for taking the time.")}</p>}
          {!dashboard ? (
            <p role="status">{t("Loading your feedback cycles…")}</p>
          ) : dashboard.activeCycle ? (
            <>
              <div className="section-heading">
                <div><p className="eyebrow">{t("Today")}</p><h2 id="active-feedback-title">{t("Your feedback is waiting")}</h2></div>
                <span className="status-pill status-pill--pending">{t("Pending")}</span>
              </div>
              <p className="active-feedback__intro">{t("Think about the last two weeks. Your answers are confidential and shown only in anonymous group results.")}</p>
              <dl className="cycle-meta">
                <div><dt>{t("Team")}</dt><dd>{dashboard.activeCycle.teamName}</dd></div>
                <div><dt>{t("Coordinator")}</dt><dd>{dashboard.activeCycle.coordinatorName}</dd></div>
                <div><dt>{t("Closes")}</dt><dd>{date(dashboard.activeCycle.closesAt, { weekday: "long", hour: "2-digit", minute: "2-digit" })}</dd></div>
              </dl>
              {!surveyOpen ? (
                <button className="case-link primary dashboard-action" onClick={() => setSurveyOpen(true)}>
                  <span>{t("Answer now")}</span><span className="case-link__icon" aria-hidden="true" />
                </button>
              ) : (
                <form className="survey-form" onSubmit={submit}>
                  <p className="survey-form__hint">{t("1 means very dissatisfied; 5 means very satisfied.")}</p>
                  <RatingField label={t("How do you feel about your coordinator?")} value={ratings.coordinator} onChange={(value) => setRatings({ ...ratings, coordinator: value })} />
                  <RatingField label={t("How do you feel about your team?")} value={ratings.team} onChange={(value) => setRatings({ ...ratings, team: value })} />
                  <RatingField label={t("How do you feel about your work?")} value={ratings.work} onChange={(value) => setRatings({ ...ratings, work: value })} />
                  <label className="comment-field"><span>{t("Anything else you’d like to share? (optional)")}</span><textarea value={comment} maxLength={2000} onChange={(event) => setComment(event.target.value)} /></label>
                  <ErrorMessage message={loadError} />
                  <Primary busy={busy} disabled={Object.values(ratings).some((rating) => rating === 0)}>{t(busy ? "Sending feedback…" : "Send feedback")}</Primary>
                  <button type="button" className="text-button align-left" onClick={() => setSurveyOpen(false)}>{t("Answer later")}</button>
                </form>
              )}
            </>
          ) : (
            <div className="all-done"><span className="all-done__mark" aria-hidden="true">✓</span><div><p className="eyebrow">{t("All done")}</p><h2 id="active-feedback-title">{t("Nothing pending today")}</h2><p>{t("We’ll let you know when the next feedback cycle opens.")}</p></div></div>
          )}
          {!surveyOpen && <ErrorMessage message={loadError || logoutError} />}
        </section>

        <section className="cycle-history" aria-labelledby="history-title">
          <div className="section-heading">
            <div><p className="eyebrow">{t("History")}</p><h2 id="history-title">{t("Your participation")}</h2></div>
            <strong>{dashboard ? t("{count} completed", { count: String(dashboard.history.filter((cycle) => cycle.status === "done").length) }) : "—"}</strong>
          </div>
          <p>{t("We only show whether you participated. Your answers and scores never appear here.")}</p>
          <div className="cycle-grid" aria-label={t("Past feedback cycles")}>
            {dashboard?.history.map((cycle) => (
              <article className={`cycle-square cycle-square--${cycle.status}`} key={cycle.cycleId} aria-label={`${date(cycle.opensAt, { dateStyle: "long" })}: ${t(cycle.status)}`}>
                <span className="cycle-square__mark" aria-hidden="true">{cycle.status === "done" ? "✓" : "–"}</span>
                <time dateTime={cycle.opensAt}>{date(cycle.opensAt, { day: "2-digit", month: "short" })}</time>
                <span>{t(cycle.status)}</span>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

function RatingField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return <fieldset className="rating-field"><legend>{label}</legend><div>{[1, 2, 3, 4, 5].map((rating) => <label key={rating} className={value === rating ? "is-selected" : ""}><input type="radio" name={label} value={rating} checked={value === rating} onChange={() => onChange(rating)} required /><span>{rating}</span></label>)}</div></fieldset>;
}

function Field(props: {
  label: string;
  type: string;
  value: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
  autoComplete?: string;
  hint?: string;
  minLength?: number;
}) {
  const { label, hint, onChange, ...inputProps } = props;
  const { t } = useLocale();
  const id = useId();
  return (
    <label className="field" htmlFor={id}>
      <span>{label}</span>
      <input
        id={id}
        {...inputProps}
        required
        aria-describedby={hint ? `${id}-hint` : undefined}
        onChange={(event) => {
          event.target.setCustomValidity("");
          onChange?.(event.target.value);
        }}
        onInvalid={(event) => {
          const input = event.currentTarget;
          input.setCustomValidity("");
          input.setCustomValidity(t(input.validity.valueMissing ? "Please fill out this field." : input.validity.typeMismatch ? "Please enter a valid email address." : "Use at least 15 characters."));
        }}
      />
      {hint && <small id={`${id}-hint`}>{hint}</small>}
    </label>
  );
}
