import { type FormEvent, type ReactNode, useEffect, useState } from "react";
import { api, type CurrentUser } from "./api";
import { useLocale } from "./i18n";
import { SiteHeader } from "./components/SiteHeader";
import { SiteFooter } from "./components/SiteFooter";
import { ErrorMessage, errorText, Field, initials, Primary } from "./components/ui";
import { CoordinatorSection } from "./views/CoordinatorSection";
import { AdminSection } from "./views/AdminSection";
import { AboutPage } from "./views/AboutPage";
import type { EmployeeDashboardData } from "./types";

function currentRoute() {
  const url = new URL(window.location.href);
  const token = new URLSearchParams(url.hash.slice(1)).get("token") ?? url.searchParams.get("token") ?? undefined;
  const view = url.pathname === "/accept-invite" ? "invite" : url.pathname === "/reset-password" ? "reset" : url.pathname === "/sobre" || url.pathname === "/about" ? "about" : "login";
  if (view === "invite" || view === "reset") {
    url.hash = "";
    url.searchParams.delete("token");
    window.history.replaceState({}, "", url.pathname + url.search);
  }
  return { view, token };
}
const route = currentRoute();
type Invite = { email: string; displayName: string; expiresAt: string };
const introKey = (userId: string) => `feedback:intro-completed:${userId}`;
const WELCOME_REVEAL_INTERVAL = 2_000;

function hasCompletedIntro(userId: string) {
  try { return window.localStorage.getItem(introKey(userId)) === "1"; } catch { return false; }
}

/** The introduction explains the employee survey, so only people who answer it see it. */
function needsIntro(user: CurrentUser) {
  return user.roles.includes("employee") && !hasCompletedIntro(user.id);
}

export function App() {
  const { t, locale } = useLocale();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [introComplete, setIntroComplete] = useState(false);
  const [checking, setChecking] = useState(true);
  const [logoutError, setLogoutError] = useState("");

  useEffect(() => {
    api<{ user: CurrentUser }>("/api/auth/me")
      .then(({ user: nextUser }) => {
        setUser(nextUser);
        setIntroComplete(!needsIntro(nextUser));
      })
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

  function authenticate(nextUser: CurrentUser) {
    setUser(nextUser);
    setIntroComplete(!needsIntro(nextUser));
  }

  function finishIntro() {
    if (!user) return;
    try { window.localStorage.setItem(introKey(user.id), "1"); } catch { /* Continue for this session if storage is unavailable. */ }
    setIntroComplete(true);
  }

  // The about page is public and independent from the session.
  if (route.view === "about") return <div className="page-shell"><a className="skip-link" href="#main-content">{t("Skip to content")}</a><AboutPage /></div>;

  return (
    <div className="page-shell">
      <a className="skip-link" href="#main-content">{t("Skip to content")}</a>
      {user && <SiteHeader user={user} onSignOut={logout} introMode={!introComplete} />}
      {checking ? (
        <main id="main-content" className="guest-loading"><img src="/assets/logo.svg" alt="" aria-hidden="true" /><p role="status">{t("Preparing your workspace…")}</p></main>
      ) : user && !introComplete ? (
        <ProductIntro user={user} onComplete={finishIntro} />
      ) : user ? (
        <Home user={user} error={logoutError} />
      ) : route.view === "invite" ? (
        <AcceptInvite token={route.token} onAccepted={authenticate} />
      ) : route.view === "reset" ? (
        <ResetPassword token={route.token} />
      ) : (
        <Login onLogin={authenticate} />
      )}
      {user && introComplete && <SiteFooter />}
    </div>
  );
}

function Shell({ eyebrow, title, children }: { eyebrow: string; title: string; children: ReactNode }) {
  const { t } = useLocale();
  return (
    <main id="main-content" className="guest-screen guest-screen--form page-width">
      <a className="guest-logo" href="/" aria-label={t("Team Feedback")}><img src="/assets/logo.svg" alt="" aria-hidden="true" /></a>
      <section className="guest-form-panel" aria-labelledby="form-title">
        <div className="form-card">
          {eyebrow && <p className="eyebrow">{eyebrow}</p>}
          <h2 id="form-title">{title}</h2>
          {children}
        </div>
      </section>
      <span className="guest-accent" aria-hidden="true" />
    </main>
  );
}

function IntroAvatar({ name, imageUrl, size }: { name: string; imageUrl?: string; size: "coordinator" | "employee" }) {
  return (
    <span className={`intro-avatar intro-avatar--${size}`}>
      {imageUrl ? <img src={imageUrl} alt="" /> : <span aria-hidden="true">{initials(name)}</span>}
    </span>
  );
}

function ProductIntro({ user, onComplete }: { user: CurrentUser; onComplete: () => void }) {
  const { t } = useLocale();
  const [step, setStep] = useState(0);
  const [welcomeReveal, setWelcomeReveal] = useState(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 4 : 0);
  const [coordinatorDisplayName, setCoordinatorDisplayName] = useState("");
  const [coordinatorAvatarUrl, setCoordinatorAvatarUrl] = useState<string>();
  const last = step === 3;
  const coordinatorName = coordinatorDisplayName.trim().split(/\s+/)[0] || t("your coordinator");
  const coordinatorAvatarName = coordinatorDisplayName || t("Coordinator");

  useEffect(() => {
    if (!user.roles.includes("employee")) return;
    api<EmployeeDashboardData>("/api/employee/dashboard")
      .then((dashboard) => {
        const activeCycle = dashboard.activeCycle;
        const name = dashboard.team?.coordinatorName ?? activeCycle?.coordinatorName;
        if (name) setCoordinatorDisplayName(name);
        if (activeCycle?.coordinatorAvatarUrl) setCoordinatorAvatarUrl(activeCycle.coordinatorAvatarUrl);
      })
      .catch(() => undefined);
  }, [user.id, user.roles]);

  useEffect(() => {
    if (step !== 0) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setWelcomeReveal(4);
      return;
    }
    setWelcomeReveal(0);
    const timers = [1, 2, 3, 4].map((reveal) => window.setTimeout(() => setWelcomeReveal(reveal), reveal * WELCOME_REVEAL_INTERVAL));
    return () => timers.forEach(window.clearTimeout);
  }, [step]);

  return (
    <main id="main-content" className={`intro-screen intro-screen--step-${step} page-width`}>
      <section className="intro-stage" aria-live="polite">
        {step === 0 && (
          <div className="intro-stage__content intro-welcome">
            <h1 className="intro-reveal">{t("Hey!")}</h1>
            {welcomeReveal >= 1 && <p className="intro-reveal">{t("Come on in.")}</p>}
            {welcomeReveal >= 2 && <p className="intro-reveal">{t("The sun was hot, right? Want a little water?")}</p>}
            {welcomeReveal >= 3 && <p className="intro-reveal">{t("Have a seat and don’t mind the mess. We’re just finishing up around here.")}</p>}
          </div>
        )}

        {step === 1 && (
          <div className="intro-stage__content intro-org">
            <div>
              <h1>{t("Organization chart")}</h1>
              <p>{coordinatorDisplayName
                ? t("I asked around and saw you report to {name}, right?", { name: coordinatorName })
                : t("I asked around, but I couldn’t find your coordinator yet. Once you’re added to a team, they’ll show up here.")}</p>
            </div>
            <div className="intro-org__diagram" role="img" aria-label={t("You and your coordinator")}>
              <IntroAvatar name={coordinatorAvatarName} imageUrl={coordinatorAvatarUrl} size="coordinator" />
              <i aria-hidden="true" />
              <IntroAvatar name={user.displayName} imageUrl={user.avatarUrl} size="employee" />
            </div>
            <div className="intro-org__copy">
              <p><strong>{t("Every other Friday")}</strong> {t("you’ll tell me how things are going over there.")}</p>
              <p>{t("Whether {name} has been helping you, whether your teammates have been treating you well, whether you’ve been working like crazy — that kind of thing.", { name: coordinatorName })}</p>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="intro-stage__content intro-ratings">
            <div>
              <h1>{t("Ratings")}</h1>
              <p>{t("We’ll show you a question and you give it a score.")}</p>
            </div>
            <div className="intro-rating-scale" aria-label={t("Rating scale from 1 to 5")}>
              {[1, 2, 3, 4, 5].map((rating) => <span key={rating}>{rating}</span>)}
            </div>
            <p className="intro-ratings__where">{t("where")}</p>
            <div className="intro-rating-legend">
              <div><strong>1</strong><span>{t("Means really bad")}</span></div>
              <div><strong>5</strong><span>{t("Means really great")}</span></div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="intro-stage__content intro-history">
            <div>
              <h1>{t("Your ratings")}</h1>
              <p>{t("Here you can quickly see which feedback cycles you joined and when the next one is.")}</p>
            </div>
            <div className="intro-history__cards" aria-label={t("Example feedback history")}>
              <article className="intro-history-card intro-history-card--next">
                <img src="/assets/icons/ellipsis.svg" alt="" aria-hidden="true" />
                <time>{t("SEP 25")}</time>
                <strong>{t("Next feedback")}</strong>
              </article>
              <article className="intro-history-card intro-history-card--skipped">
                <img src="/assets/icons/dash.svg" alt="" aria-hidden="true" />
                <time>{t("SEP 11")}</time>
                <strong>{t("Not answered")}</strong>
              </article>
              <article className="intro-history-card intro-history-card--done">
                <img src="/assets/icons/check.svg" alt="" aria-hidden="true" />
                <time>{t("AUG 28")}</time>
                <strong>{t("Completed")}</strong>
              </article>
            </div>
          </div>
        )}

        {(step !== 0 || welcomeReveal >= 4) && (
          <button className={`intro-continue intro-reveal${last ? " intro-continue--final" : ""}`} type="button" onClick={() => last ? onComplete() : setStep((currentStep) => currentStep + 1)}>
            {t("Continue")}
          </button>
        )}
      </section>
    </main>
  );
}

function Login({ onLogin }: { onLogin: (user: CurrentUser) => void }) {
  const { t } = useLocale();
  const [started, setStarted] = useState(false);
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

  if (!started) {
    return (
      <main id="main-content" className="guest-screen guest-screen--hero page-width">
        <img className="guest-logo" src="/assets/logo.svg" alt="" aria-hidden="true" />
        <section className="guest-hero-copy" aria-labelledby="guest-title">
          <h1 id="guest-title">{t("Our 1:1 platform")}</h1>
          <p>{t("The hand that corrects is the same one that comforts. Growth without HR nonsense.")}</p>
        </section>
        <button className="case-link guest-login-action" type="button" onClick={() => setStarted(true)}>
          <span>{t("Start sign in")}</span><span className="case-link__icon" aria-hidden="true" />
        </button>
        <span className="guest-accent" aria-hidden="true" />
      </main>
    );
  }

  return (
    <Shell eyebrow={t(forgot ? "Account recovery" : "")} title={t(forgot ? "Reset your password" : "Enter your login details")}>
      <form onSubmit={submit} className={forgot ? "stack" : "stack login-form"}>
        {!forgot && <p className="login-support">{t("Having trouble? Talk to me and I’ll sort it out for you:")} <a href="mailto:ino@mail.praiasertao.com.br">ino@mail.praiasertao.com.br</a></p>}
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

const ROLE_ORDER = ["employee", "coordinator", "admin"] as const;
const HERO_COPY = {
  coordinator: { status: "Your team", lead: "Here’s how your team is doing — always as a group, never one person at a time." },
  admin: { status: "Administration", lead: "Invite people, adjust access, and keep teams and coordination up to date." },
} as const;

/** One home for every profile: a person with several roles sees each role's sections in order. */
function Home({ user, error }: { user: CurrentUser; error: string }) {
  const { t } = useLocale();
  const roles = ROLE_ORDER.filter((role) => user.roles.includes(role));
  const primary = roles[0];
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const firstName = user.displayName.trim().split(/\s+/)[0];
  const status = primary === "employee" ? (feedbackOpen ? "Feedback open today" : "Your feedback space") : primary ? HERO_COPY[primary].status : "Workspace ready";
  const lead = primary === "employee" ? "A few honest minutes today can make the next conversation better." : primary ? HERO_COPY[primary].lead : "Your account doesn’t have an access profile yet. Ask an administrator.";

  return (
    <main id="main-content" className="dashboard page-width">
      <section className="dashboard-hero">
        <p className="availability"><span className="availability__dot" aria-hidden="true" />{t(status)}</p>
        <h1>{t("Hello, {name}", { name: firstName })}</h1>
        <p>{t(lead)}</p>
      </section>
      {roles.includes("employee") && <EmployeeSection user={user} onActiveCycle={setFeedbackOpen} />}
      {roles.includes("coordinator") && <CoordinatorSection />}
      {roles.includes("admin") && <AdminSection currentUserId={user.id} />}
      <ErrorMessage message={error} />
    </main>
  );
}

function EmployeeSection({ onActiveCycle }: { user: CurrentUser; onActiveCycle: (open: boolean) => void }) {
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
      const next = await api<EmployeeDashboardData>("/api/employee/dashboard");
      setDashboard(next);
      onActiveCycle(Boolean(next.activeCycle));
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

  return (
    <div className="dashboard-layout">
      <section className="active-feedback" id="active-feedback" aria-labelledby="active-feedback-title">
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
        {!surveyOpen && <ErrorMessage message={loadError} />}
      </section>

      <section className="cycle-history" id="history" aria-labelledby="history-title">
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
  );
}

function RatingField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return <fieldset className="rating-field"><legend>{label}</legend><div>{[1, 2, 3, 4, 5].map((rating) => <label key={rating} className={value === rating ? "is-selected" : ""}><input type="radio" name={label} value={rating} checked={value === rating} onChange={() => onChange(rating)} required /><span>{rating}</span></label>)}</div></fieldset>;
}

