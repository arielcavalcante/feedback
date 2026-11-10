import { type FormEvent, useEffect, useId, useState } from "react";
import { api } from "../api";
import { useLocale } from "../i18n";
import { ErrorMessage, errorText, Field, initials, Primary } from "../components/ui";
import { useToast } from "../components/Toast";
import type { AdminTeam, AdminUser, PauseState, RoleKey } from "../types";
import { formatInZone } from "../components/ui";

const ROLES: RoleKey[] = ["admin", "coordinator", "employee"];
const STATUS_LABEL: Record<AdminUser["status"], string> = {
  active: "Active",
  invited: "Invite sent",
  invite_expired: "Invite expired",
  inactive: "Inactive",
};

type InvitationResponse = { invitation: { email: string; actionUrl?: string } };

export function AdminSection({ currentUserId }: { currentUserId: string }) {
  const { t } = useLocale();
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [teams, setTeams] = useState<AdminTeam[] | null>(null);
  const [error, setError] = useState("");

  async function reload() {
    const [userData, teamData] = await Promise.all([
      api<{ users: AdminUser[] }>("/api/admin/users"),
      api<{ teams: AdminTeam[] }>("/api/admin/teams"),
    ]);
    setUsers(userData.users);
    setTeams(teamData.teams);
  }

  useEffect(() => { reload().catch((caught) => setError(errorText(caught, "Unable to load people and teams."))); }, []);

  if (!users || !teams) {
    return (
      <section className="admin-panel" id="people">
        {error ? <ErrorMessage message={error} /> : <p role="status">{t("Loading people and teams…")}</p>}
      </section>
    );
  }
  return (
    <>
      <CheckinsPanel />
      <PeoplePanel users={users} teams={teams} currentUserId={currentUserId} onChanged={reload} />
      <TeamsPanel users={users} teams={teams} onChanged={reload} />
    </>
  );
}

function PeoplePanel({ users, teams, currentUserId, onChanged }: { users: AdminUser[]; teams: AdminTeam[]; currentUserId: string; onChanged: () => Promise<void> }) {
  const { t } = useLocale();
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const toast = useToast();
  const [error, setError] = useState("");
  const teamName = (teamId: string | null) => teams.find((team) => team.id === teamId)?.name;
  const activeCount = users.filter((user) => user.status !== "inactive").length;

  async function run(userId: string | null, action: () => Promise<void>) {
    setBusyId(userId); setError("");
    try { await action(); await onChanged(); }
    catch (caught) { setError(errorText(caught, "Something went wrong. Please try again.")); }
    finally { setBusyId(null); }
  }

  async function sendInvitation(values: PersonValues) {
    const result = await api<InvitationResponse>("/api/admin/invitations", { method: "POST", body: JSON.stringify(values) });
    toast(t("Invitation sent to {email}.", { email: result.invitation.email }), result.invitation.actionUrl ? { href: result.invitation.actionUrl, label: t("Open invitation link (development only)") } : undefined);
  }

  return (
    <section className="admin-panel" id="people" aria-labelledby="people-title">
      <div className="section-heading">
        <div><p className="eyebrow">{t("People")}</p><h2 id="people-title">{t("Who’s on ino")}</h2></div>
        <strong>{t("{count} active", { count: String(activeCount) })}</strong>
      </div>
      <p className="admin-panel__intro">{t("Invite people, choose what each one can access, and set their team. Survey answers never appear here.")}</p>

      <ErrorMessage message={error} />

      {creating ? (
        <PersonForm
          teams={teams}
          submitLabel="Send invitation"
          onCancel={() => setCreating(false)}
          onSubmit={(values) => run(null, async () => { await sendInvitation(values); setCreating(false); })}
        />
      ) : (
        <button className="case-link primary admin-panel__add" type="button" onClick={() => { setCreating(true); setEditingId(null); }}>
          <span>{t("Add person")}</span><span className="case-link__icon" aria-hidden="true" />
        </button>
      )}

      <ul className="admin-list" aria-label={t("People")}>
        {users.map((user) => {
          const isSelf = user.id === currentUserId;
          if (editingId === user.id) {
            return (
              <li className="admin-row admin-row--editing" key={user.id}>
                <PersonForm
                  initial={user}
                  teams={teams}
                  isSelf={isSelf}
                  submitLabel="Save changes"
                  onCancel={() => setEditingId(null)}
                  onSubmit={(values) => run(user.id, async () => {
                    await api(`/api/admin/users/${user.id}`, { method: "PATCH", body: JSON.stringify({ displayName: values.displayName, roles: values.roles, teamId: values.teamId }) });
                    setEditingId(null);
                    toast(t("Changes saved for {name}.", { name: values.displayName }));
                  })}
                />
              </li>
            );
          }
          const team = teamName(user.teamId);
          return (
            <li className={`admin-row${user.status === "inactive" ? " is-inactive" : ""}`} key={user.id}>
              <span className="admin-avatar" aria-hidden="true">{initials(user.displayName)}</span>
              <div className="admin-row__main">
                <strong>{user.displayName}{isSelf && <span className="admin-row__you"> · {t("you")}</span>}</strong>
                <span title={user.email}>{user.email}</span>
              </div>
              <div className="admin-row__meta">
                <span className={`admin-status admin-status--${user.status}`}>{t(STATUS_LABEL[user.status])}</span>
                {user.roles.map((role) => <span className="role-chip" key={role}>{t(role)}</span>)}
                <span className={`admin-row__team${!team && user.roles.includes("employee") && user.status !== "inactive" ? " is-warning" : ""}`}>
                  {team ?? t(user.roles.includes("employee") && user.status !== "inactive" ? "No team — stays out of cycles" : "No team")}
                </span>
              </div>
              <div className="admin-row__actions">
                {confirmingId === user.id ? (
                  <>
                    <span className="admin-row__confirm">{t("They lose access right away.")}</span>
                    <button type="button" className="text-button text-button--danger" disabled={busyId === user.id} onClick={() => run(user.id, async () => {
                      await api(`/api/admin/users/${user.id}`, { method: "PATCH", body: JSON.stringify({ isActive: false }) });
                      setConfirmingId(null);
                      toast(t("{name} was deactivated.", { name: user.displayName }));
                    })}>{t("Confirm deactivation")}</button>
                    <button type="button" className="text-button" onClick={() => setConfirmingId(null)}>{t("Cancel")}</button>
                  </>
                ) : (
                  <>
                    {user.status !== "inactive" && <button type="button" className="text-button" onClick={() => { setEditingId(user.id); setCreating(false); setConfirmingId(null); }}>{t("Edit")}</button>}
                    {(user.status === "invited" || user.status === "invite_expired") && (
                      <button type="button" className="text-button" disabled={busyId === user.id} onClick={() => run(user.id, () => sendInvitation({ email: user.email, displayName: user.displayName, roles: user.roles, teamId: user.teamId }))}>{t("Resend invite")}</button>
                    )}
                    {!isSelf && user.status !== "inactive" && <button type="button" className="text-button" onClick={() => setConfirmingId(user.id)}>{t("Deactivate")}</button>}
                    {user.status === "inactive" && (
                      <button type="button" className="text-button" disabled={busyId === user.id} onClick={() => run(user.id, async () => {
                        await api(`/api/admin/users/${user.id}`, { method: "PATCH", body: JSON.stringify({ isActive: true }) });
                        toast(t("{name} was reactivated.", { name: user.displayName }));
                      })}>{t("Reactivate")}</button>
                    )}
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

type PersonValues = { email: string; displayName: string; roles: RoleKey[]; teamId: string | null };

function PersonForm({ initial, teams, isSelf = false, submitLabel, onSubmit, onCancel }: {
  initial?: AdminUser; teams: AdminTeam[]; isSelf?: boolean; submitLabel: string;
  onSubmit: (values: PersonValues) => Promise<void>; onCancel: () => void;
}) {
  const { t } = useLocale();
  const id = useId();
  const [displayName, setDisplayName] = useState(initial?.displayName ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [roles, setRoles] = useState<RoleKey[]>(initial?.roles ?? ["employee"]);
  const [teamId, setTeamId] = useState(initial?.teamId ?? "");
  const [busy, setBusy] = useState(false);
  const activeTeams = teams.filter((team) => team.isActive);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try { await onSubmit({ email, displayName: displayName.trim(), roles, teamId: teamId || null }); }
    finally { setBusy(false); }
  }

  return (
    <form className="admin-form" onSubmit={submit}>
      <div className="admin-form__fields">
        <Field label={t("Name")} type="text" value={displayName} onChange={setDisplayName} autoComplete="off" maxLength={120} />
        <Field label={t("Work email")} type="email" value={email} onChange={setEmail} readOnly={Boolean(initial)} autoComplete="off" />
      </div>
      <fieldset className="role-options">
        <legend>{t("Access profiles")}</legend>
        {ROLES.map((role) => {
          const locked = isSelf && role === "admin";
          return (
            <label key={role} className={roles.includes(role) ? "is-selected" : ""}>
              <input
                type="checkbox"
                checked={roles.includes(role)}
                disabled={locked}
                onChange={(event) => setRoles((current) => event.target.checked ? ROLES.filter((item) => item === role || current.includes(item)) : current.filter((item) => item !== role))}
              />
              <span>{t(role)}</span>
            </label>
          );
        })}
        {isSelf && <small>{t("You can’t remove your own admin access.")}</small>}
      </fieldset>
      <label className="field" htmlFor={`${id}-team`}>
        <span>{t("Team")}</span>
        <select id={`${id}-team`} value={teamId} onChange={(event) => setTeamId(event.target.value)} aria-describedby={`${id}-team-hint`}>
          <option value="">{t("No team")}</option>
          {activeTeams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
        </select>
        <small id={`${id}-team-hint`}>{t("Employees answer about the coordination of the team they’re in.")}</small>
      </label>
      <div className="admin-form__actions">
        <Primary busy={busy} disabled={roles.length === 0}>{t(busy ? "Saving…" : submitLabel)}</Primary>
        <button type="button" className="text-button" onClick={onCancel}>{t("Cancel")}</button>
      </div>
    </form>
  );
}

function TeamsPanel({ users, teams, onChanged }: { users: AdminUser[]; teams: AdminTeam[]; onChanged: () => Promise<void> }) {
  const { t } = useLocale();
  const toast = useToast();
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const coordinators = users.filter((user) => user.status !== "inactive" && user.roles.includes("coordinator"));
  const nameOf = (userId: string | null) => users.find((user) => user.id === userId)?.displayName;

  async function run(teamId: string | null, action: () => Promise<void>) {
    setBusyId(teamId); setError("");
    try { await action(); await onChanged(); }
    catch (caught) { setError(errorText(caught, "Something went wrong. Please try again.")); }
    finally { setBusyId(null); }
  }

  return (
    <section className="admin-panel" id="teams" aria-labelledby="teams-title">
      <div className="section-heading">
        <div><p className="eyebrow">{t("Teams")}</p><h2 id="teams-title">{t("Teams and coordination")}</h2></div>
        <strong>{t("{count} active", { count: String(teams.filter((team) => team.isActive).length) })}</strong>
      </div>
      <p className="admin-panel__intro">{t("Each team needs a coordinator. Every week, people on the team rate their coordinator and can send complaints to them.")}</p>
      <ErrorMessage message={error} />

      {creating ? (
        <TeamForm coordinators={coordinators} submitLabel="Create team" onCancel={() => setCreating(false)} onSubmit={(values) => run(null, async () => {
          await api("/api/admin/teams", { method: "POST", body: JSON.stringify(values) });
          setCreating(false);
          toast(t("Team {name} created.", { name: values.name }));
        })} />
      ) : (
        <button className="case-link primary admin-panel__add" type="button" onClick={() => { setCreating(true); setEditingId(null); }}>
          <span>{t("New team")}</span><span className="case-link__icon" aria-hidden="true" />
        </button>
      )}

      {teams.length === 0 && !creating && <p className="helper">{t("No teams yet. Create the first one to start the cycles.")}</p>}
      <ul className="admin-list" aria-label={t("Teams")}>
        {teams.map((team) => {
          if (editingId === team.id) {
            return (
              <li className="admin-row admin-row--editing" key={team.id}>
                <TeamForm initial={team} coordinators={coordinators} submitLabel="Save changes" onCancel={() => setEditingId(null)} onSubmit={(values) => run(team.id, async () => {
                  await api(`/api/admin/teams/${team.id}`, { method: "PATCH", body: JSON.stringify(values) });
                  setEditingId(null);
                  toast(t("Changes saved for {name}.", { name: values.name }));
                })} />
              </li>
            );
          }
          const coordinator = nameOf(team.coordinatorUserId);
          return (
            <li className={`admin-row admin-row--team${team.isActive ? "" : " is-inactive"}`} key={team.id}>
              <div className="admin-row__main">
                <strong>{team.name}</strong>
                <span className={!coordinator && team.isActive ? "is-warning" : ""}>{coordinator ? t("Coordinated by {name}", { name: coordinator }) : t(team.isActive ? "No coordination — this team stays out of cycles" : "No coordination")}</span>
              </div>
              <div className="admin-row__meta">
                {!team.isActive && <span className="admin-status admin-status--inactive">{t("Inactive")}</span>}
                <span className="admin-row__team">{t(team.memberCount === 1 ? "1 person" : "{count} people", { count: String(team.memberCount) })}</span>
              </div>
              <div className="admin-row__actions">
                {confirmingId === team.id ? (
                  <>
                    <span className="admin-row__confirm">{t("Members will be left without a team.")}</span>
                    <button type="button" className="text-button text-button--danger" disabled={busyId === team.id} onClick={() => run(team.id, async () => {
                      await api(`/api/admin/teams/${team.id}`, { method: "PATCH", body: JSON.stringify({ isActive: false }) });
                      setConfirmingId(null);
                    })}>{t("Confirm deactivation")}</button>
                    <button type="button" className="text-button" onClick={() => setConfirmingId(null)}>{t("Cancel")}</button>
                  </>
                ) : team.isActive ? (
                  <>
                    <button type="button" className="text-button" onClick={() => { setEditingId(team.id); setCreating(false); }}>{t("Edit")}</button>
                    <button type="button" className="text-button" onClick={() => setConfirmingId(team.id)}>{t("Deactivate")}</button>
                  </>
                ) : (
                  <button type="button" className="text-button" disabled={busyId === team.id} onClick={() => run(team.id, async () => {
                    await api(`/api/admin/teams/${team.id}`, { method: "PATCH", body: JSON.stringify({ isActive: true }) });
                  })}>{t("Reactivate")}</button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function TeamForm({ initial, coordinators, submitLabel, onSubmit, onCancel }: {
  initial?: AdminTeam; coordinators: AdminUser[]; submitLabel: string;
  onSubmit: (values: { name: string; coordinatorUserId: string | null }) => Promise<void>; onCancel: () => void;
}) {
  const { t } = useLocale();
  const id = useId();
  const [name, setName] = useState(initial?.name ?? "");
  const [coordinatorUserId, setCoordinatorUserId] = useState(initial?.coordinatorUserId ?? "");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try { await onSubmit({ name: name.trim(), coordinatorUserId: coordinatorUserId || null }); }
    finally { setBusy(false); }
  }

  return (
    <form className="admin-form" onSubmit={submit}>
      <div className="admin-form__fields">
        <Field label={t("Team name")} type="text" value={name} onChange={setName} autoComplete="off" maxLength={80} />
        <label className="field" htmlFor={`${id}-coordinator`}>
          <span>{t("Coordinator")}</span>
          <select id={`${id}-coordinator`} value={coordinatorUserId} onChange={(event) => setCoordinatorUserId(event.target.value)} aria-describedby={`${id}-coordinator-hint`}>
            <option value="">{t("No coordination yet")}</option>
            {coordinators.map((user) => <option key={user.id} value={user.id}>{user.displayName}</option>)}
          </select>
          <small id={`${id}-coordinator-hint`}>{t(coordinators.length ? "Only people with the coordinator profile appear here." : "Give someone the coordinator profile first.")}</small>
        </label>
      </div>
      <div className="admin-form__actions">
        <Primary busy={busy}>{t(busy ? "Saving…" : submitLabel)}</Primary>
        <button type="button" className="text-button" onClick={onCancel}>{t("Cancel")}</button>
      </div>
    </form>
  );
}

/** Organization-wide pause of the weekly check-ins (ADR-030). */
function CheckinsPanel() {
  const { t, locale } = useLocale();
  const toast = useToast();
  const [state, setState] = useState<PauseState | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api<{ checkins: PauseState }>("/api/admin/settings").then(({ checkins }) => setState(checkins)).catch((caught) => setError(errorText(caught, "Something went wrong. Please try again.")));
  }, []);

  async function update(paused: boolean) {
    setBusy(true); setError("");
    try {
      const { checkins } = await api<{ checkins: PauseState }>("/api/admin/settings", { method: "PATCH", body: JSON.stringify({ checkinsPaused: paused }) });
      setState(checkins); setConfirming(false);
      toast(t(paused ? "Check-ins paused for everyone." : "Check-ins are back. The next one opens on Monday."));
    } catch (caught) {
      setError(errorText(caught, "Something went wrong. Please try again."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="admin-panel checkins-panel" id="checkins" aria-labelledby="checkins-title">
      <div className="section-heading">
        <div><p className="eyebrow">{t("Weekly check-ins")}</p><h2 id="checkins-title">{t(state?.paused ? "Check-ins are paused" : "Check-ins are running")}</h2></div>
        {state && <span className={`status-pill ${state.paused ? "status-pill--paused" : "status-pill--ready"}`}>{t(state.paused ? "Paused" : "Running")}</span>}
      </div>
      <p className="admin-panel__intro">{t(state?.paused
        ? "Nobody gets a check-in or a check-in email while this is paused. Complaints, conversations and past results keep working."
        : "Every Monday a new check-in opens for everyone on a team. Pausing stops it for the whole company at once.")}</p>
      {state?.paused && state.since && (
        <p className="helper checkins-panel__since">{t(state.byName ? "Paused on {date} by {name}." : "Paused on {date}.", { date: formatInZone(state.since, locale, { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }), name: state.byName ?? "" })}</p>
      )}
      <ErrorMessage message={error} />
      {state && (confirming ? (
        <div className="sign-confirm" role="group" aria-label={t("Pause check-ins")}>
          <p>{t("This week’s check-in closes now for everyone (if nobody answered yet, it’s dropped) and no new one opens until you resume.")}</p>
          <div>
            <button type="button" className="text-button" disabled={busy} onClick={() => update(true)}>{t("Pause for everyone")}</button>
            <button type="button" className="text-button" onClick={() => setConfirming(false)}>{t("Cancel")}</button>
          </div>
        </div>
      ) : state.paused ? (
        <button className="case-link primary admin-panel__add" type="button" disabled={busy} onClick={() => update(false)}>
          <span>{t("Resume check-ins")}</span><span className="case-link__icon" aria-hidden="true" />
        </button>
      ) : (
        <button className="case-link secondary admin-panel__add" type="button" onClick={() => setConfirming(true)}>
          <span>{t("Pause check-ins")}</span><span className="case-link__icon" aria-hidden="true" />
        </button>
      ))}
    </section>
  );
}
