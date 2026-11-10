import { useEffect, useState } from "react";
import { api } from "../api";
import { useLocale } from "../i18n";
import { ErrorMessage, errorText, formatInZone } from "../components/ui";
import type { CoordinatorComplaints, CoordinatorDashboardData, CoordinatorTeam, DimensionAverages } from "../types";
import { COMPLAINT_TOPICS } from "../../shared/complaints";
import { TeamConversations } from "./TeamConversations";

const DIMENSIONS: Array<{ key: keyof DimensionAverages; label: string }> = [
  { key: "coordinator", label: "Coordinator" },
  { key: "team", label: "Team" },
  { key: "work", label: "Work" },
];

export function CoordinatorSection() {
  const { t } = useLocale();
  const [data, setData] = useState<CoordinatorDashboardData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<CoordinatorDashboardData>("/api/coordinator/dashboard")
      .then(setData)
      .catch((caught) => setError(errorText(caught, "Unable to load your team’s results.")));
  }, []);

  if (!data || !data.teams.length) {
    return (
      <div className="dashboard-layout">
        <section className="active-feedback" id="team-results" aria-labelledby="team-results-title">
          {error ? <ErrorMessage message={error} /> : !data ? <p role="status">{t("Loading your team’s results…")}</p> : (
            <div className="all-done">
              <span className="all-done__mark" aria-hidden="true">–</span>
              <div>
                <p className="eyebrow">{t("Team results")}</p>
                <h2 id="team-results-title">{t("No team yet")}</h2>
                <p>{t("When an administrator assigns you to coordinate a team, its results show up here.")}</p>
              </div>
            </div>
          )}
        </section>
      </div>
    );
  }

  const pausedBanner = data.checkinsPaused && (
    <p className="paused-banner" role="note"><span className="shell-icon" aria-hidden="true" />{t("Weekly check-ins are paused by the administration. Past results, conversations and complaints stay available.")}</p>
  );
  return <>{pausedBanner}{data.teams.map((team, index) => <TeamResults key={team.id} team={team} nextCycle={data.nextCycle} anchor={index === 0} showName={data.teams.length > 1} />)}<TeamConversations /></>;
}

function TeamResults({ team, nextCycle, anchor, showName }: { team: CoordinatorTeam; nextCycle: CoordinatorDashboardData["nextCycle"]; anchor: boolean; showName: boolean }) {
  const { t, locale } = useLocale();
  const titleId = `team-${team.id}-title`;
  const shortDate = (value: string) => formatInZone(value, locale, { day: "2-digit", month: "short" });
  const eyebrow = showName ? team.name : t("Team results");
  const latest = team.latest;

  return (
    <>
    <div className="dashboard-layout">
      <section className="active-feedback" id={anchor ? "team-results" : undefined} aria-labelledby={titleId}>
        {latest?.status === "ready"
          ? <ReadyResults latest={latest} eyebrow={eyebrow} titleId={titleId} />
          : <PendingResults team={team} nextCycle={nextCycle} eyebrow={eyebrow} titleId={titleId} />}
      </section>

      <section className="cycle-history" id={anchor ? "team-cycles" : undefined} aria-labelledby={`${titleId}-cycles`}>
        <div className="section-heading">
          <div><p className="eyebrow">{t("Cycles")}</p><h2 id={`${titleId}-cycles`}>{t("Team history")}</h2></div>
          {team.memberCount !== null && <strong>{t(team.memberCount === 1 ? "1 person" : "{count} people", { count: String(team.memberCount) })}</strong>}
        </div>
        <p>{t("A cycle releases results only after at least 3 people answer. Who answered is never shown.")}</p>
        <div className="cycle-grid" aria-label={t("Team feedback cycles")}>
          {team.openCycle ? (
            <article className="cycle-square cycle-square--next">
              <img className="cycle-square__icon" src="/assets/icons/ellipsis.svg" alt="" aria-hidden="true" />
              <time dateTime={team.openCycle.closesAt}>{t("Closes {date}", { date: shortDate(team.openCycle.closesAt) })}</time>
              <span>{t("In progress")}</span>
            </article>
          ) : nextCycle && (
            <article className="cycle-square cycle-square--next">
              <img className="cycle-square__icon" src="/assets/icons/ellipsis.svg" alt="" aria-hidden="true" />
              <time dateTime={nextCycle.opensAt}>{shortDate(nextCycle.opensAt)}</time>
              <span>{t("Next cycle")}</span>
            </article>
          )}
          {team.history.map((cycle) => {
            const ready = cycle.status === "ready";
            return (
              <article className={`cycle-square cycle-square--${ready ? "done" : "skipped"}`} key={cycle.cycleId}>
                <span className="cycle-square__mark" aria-hidden="true">{ready ? "✓" : "–"}</span>
                <time dateTime={cycle.opensAt}>{shortDate(cycle.opensAt)}</time>
                <span>{t(ready ? "Results released" : "Below minimum")}</span>
              </article>
            );
          })}
        </div>
      </section>
    </div>
    <ComplaintsPanel complaints={team.complaints} titleId={`${titleId}-complaints`} anchor={anchor} />
    </>
  );
}

function ComplaintsPanel({ complaints, titleId, anchor }: { complaints: CoordinatorComplaints; titleId: string; anchor: boolean }) {
  const { t, locale } = useLocale();
  const week = (weekStart: string) => t("Week of {date}", { date: formatInZone(`${weekStart}T12:00:00.000Z`, locale, { day: "numeric", month: "short" }) });
  const topicLabel = (key: string) => t(COMPLAINT_TOPICS.find((topic) => topic.key === key)?.label ?? key);
  const empty = !complaints.signed.length && !complaints.anonymousWeeks.length && !complaints.withheldWeeks.length;
  const Topics = ({ keys }: { keys: string[] }) => <div className="complaint-card__topics">{keys.map((key) => <span key={key}>{topicLabel(key)}</span>)}</div>;

  return (
    <section className="complaints-panel" id={anchor ? "team-complaints" : undefined} aria-labelledby={titleId}>
      <div className="section-heading">
        <div><p className="eyebrow">{t("Complaints")}</p><h2 id={titleId}>{t("What the team is complaining about")}</h2></div>
      </div>
      <p className="active-feedback__intro">{t("Signed complaints show up right away. Anonymous ones arrive every Monday for the previous week, only when at least 3 people complained — never with names.")}</p>

      {empty && <p className="helper complaints-panel__empty">{t("No complaints in the last few weeks.")}</p>}

      {complaints.signed.length > 0 && (
        <div className="complaints-group">
          <h3>{t("Signed")}</h3>
          <ul className="complaint-list">
            {complaints.signed.map((item) => (
              <li className="complaint-card" key={item.id}>
                <Topics keys={item.topics} />
                <blockquote>{item.body}</blockquote>
                <p className="complaint-card__by">{item.authorName} · {week(item.weekStart)}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {complaints.anonymousWeeks.map((group) => (
        <div className="complaints-group" key={group.weekStart}>
          <h3>{week(group.weekStart)} · {t("anonymous")}</h3>
          <ul className="complaint-list">
            {group.items.map((item) => (
              <li className="complaint-card complaint-card--anonymous" key={item.id}>
                <Topics keys={item.topics} />
                <blockquote>{item.body}</blockquote>
              </li>
            ))}
          </ul>
        </div>
      ))}

      {complaints.withheldWeeks.length > 0 && (
        <p className="helper complaints-panel__withheld">
          {t("Kept private (fewer than 3 people complained anonymously): {weeks}", { weeks: complaints.withheldWeeks.map(week).join(", ") })}
        </p>
      )}
    </section>
  );
}

function ReadyResults({ latest, eyebrow, titleId }: { latest: Extract<CoordinatorTeam["latest"], { status: "ready" }>; eyebrow: string; titleId: string }) {
  const { t, locale } = useLocale();
  const score = (value: number) => value.toLocaleString(locale === "en" ? "en-US" : "pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return (
    <>
      <div className="section-heading">
        <div><p className="eyebrow">{eyebrow}</p><h2 id={titleId}>{t("How the team is doing")}</h2></div>
        <span className="status-pill status-pill--ready">{t("{count} answers", { count: String(latest.responseCount) })}</span>
      </div>
      <p className="active-feedback__intro">{t("Week of {date}. Anonymous averages from 1 to 5, with no names and no answer order. Signed check-ins don’t count here — they’re in Conversations.", { date: formatInZone(latest.opensAt, locale, { day: "numeric", month: "long" }) })}</p>
      <div className="score-grid">
        {DIMENSIONS.map(({ key, label }) => (
          <div className="score-tile" key={key}>
            <span className="score-tile__label">{t(label)}</span>
            <strong>{score(latest.dimensions[key])}</strong>
            <span className="score-tile__bar" aria-hidden="true"><i style={{ width: `${(latest.dimensions[key] / 5) * 100}%` }} /></span>
          </div>
        ))}
      </div>
      {latest.comments.length > 0 && (
        <div className="team-comments">
          <h3>{t("What the team wrote")}</h3>
          <ul>{latest.comments.map((comment, index) => <li key={index}><blockquote>{comment}</blockquote></li>)}</ul>
        </div>
      )}
    </>
  );
}

function PendingResults({ team, nextCycle, eyebrow, titleId }: { team: CoordinatorTeam; nextCycle: CoordinatorDashboardData["nextCycle"]; eyebrow: string; titleId: string }) {
  const { t, locale } = useLocale();
  const longDate = (value: string) => formatInZone(value, locale, { weekday: "long", day: "numeric", month: "long" });
  const shortDate = (value: string) => formatInZone(value, locale, { day: "2-digit", month: "short" });
  const { openCycle, awaitingReport, latest } = team;

  let title: string; let copy: string; let card: null | { done: boolean; when: string; label: string };
  if (openCycle) {
    title = "No results yet";
    copy = t("The current cycle is open until {date}. Results show up here the Monday after it closes, if at least {threshold} people answer.", { date: longDate(openCycle.closesAt), threshold: String(openCycle.threshold) });
    card = {
      done: openCycle.thresholdReached,
      when: t("Closes {date}", { date: shortDate(openCycle.closesAt) }),
      label: t(openCycle.thresholdReached ? "Minimum of {threshold} answers reached" : "Minimum of {threshold} answers not reached yet", { threshold: String(openCycle.threshold) }),
    };
  } else if (awaitingReport) {
    title = "Results coming soon";
    copy = t("The cycle has closed. Results are released on {date} at 9am.", { date: longDate(awaitingReport.reportAt) });
    card = { done: false, when: shortDate(awaitingReport.reportAt), label: t("Results release") };
  } else {
    title = latest ? "Not enough answers" : "No results yet";
    copy = latest
      ? t("The cycle of {date} closed with fewer than {threshold} answers. To protect anonymity, its results stay hidden.", { date: formatInZone(latest.opensAt, locale, { day: "numeric", month: "long" }), threshold: String(latest.threshold) })
      : t("No cycle has closed for this team yet.");
    card = nextCycle ? { done: false, when: shortDate(nextCycle.opensAt), label: t("Next cycle opens") } : null;
  }

  return (
    <>
      <div className="section-heading">
        <div><p className="eyebrow">{eyebrow}</p><h2 id={titleId}>{t(title)}</h2></div>
        {openCycle && <span className="status-pill status-pill--pending">{t("In progress")}</span>}
      </div>
      <p className="active-feedback__intro">{copy}</p>
      <div className="pending-status">
        {card ? (
          <article className={`intro-history-card intro-history-card--${card.done ? "done" : "next"}`}>
            <img src={`/assets/icons/${card.done ? "check" : "ellipsis"}.svg`} alt="" aria-hidden="true" />
            <time>{card.when}</time>
            <strong>{card.label}</strong>
          </article>
        ) : <p className="helper">{t("No upcoming cycle is scheduled.")}</p>}
        {openCycle && (
          <p className="helper">
            {t(openCycle.participantCount === 1 ? "1 person in this cycle." : "{count} people in this cycle.", { count: String(openCycle.participantCount) })}{" "}
            {t("We never show how many or which people have already answered.")}
          </p>
        )}
      </div>
    </>
  );
}
