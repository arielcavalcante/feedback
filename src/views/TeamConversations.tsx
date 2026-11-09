import { type FormEvent, useEffect, useId, useState } from "react";
import { api } from "../api";
import { useLocale } from "../i18n";
import { ErrorMessage, errorText, formatInZone, initials, Primary } from "../components/ui";
import { SignedEvaluationCard } from "../components/SignedEvaluationCard";
import { useToast } from "../components/Toast";
import type { Conversation, TeamPerson } from "../types";

const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Fortaleza", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

/** Coordinator view: everyone on the team, their signed check-ins, and notes recorded during conversations. */
export function TeamConversations() {
  const { t, locale } = useLocale();
  const [people, setPeople] = useState<TeamPerson[] | null>(null);
  const [error, setError] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  async function load() {
    try { setPeople((await api<{ people: TeamPerson[] }>("/api/coordinator/people")).people); }
    catch (caught) { setError(errorText(caught, "Unable to load your team.")); }
  }
  useEffect(() => { void load(); }, []);

  return (
    <section className="team-people" id="team-people" aria-labelledby="team-people-title">
      <div className="section-heading">
        <div><p className="eyebrow">{t("Conversations")}</p><h2 id="team-people-title">{t("Talk with the team")}</h2></div>
      </div>
      <p className="active-feedback__intro">{t("Open someone during your conversation to see the check-ins they signed and write down what you agreed on. The notes are saved for both of you.")}</p>
      <ErrorMessage message={error} />
      {!people && !error && <p role="status">{t("Loading your team…")}</p>}
      {people && !people.length && <p className="helper conversation-empty">{t("Nobody on your team yet.")}</p>}
      <ul className="admin-list person-list">
        {people?.map((person) => {
          const open = openId === person.id;
          const last = person.conversations[0];
          return (
            <li className={`admin-row person-row${open ? " is-open" : ""}`} key={person.id}>
              <span className="admin-avatar" aria-hidden="true">{initials(person.name)}</span>
              <div className="admin-row__main">
                <strong>{person.name}</strong>
                <span>{person.teamName}</span>
              </div>
              <div className="admin-row__meta">
                {person.signedEvaluations.length > 0 && <span className="admin-status admin-status--invited">{t(person.signedEvaluations.length === 1 ? "1 signed check-in" : "{count} signed check-ins", { count: String(person.signedEvaluations.length) })}</span>}
                <span className="admin-row__team">{last ? t("Last talk: {date}", { date: formatDay(last.heldOn) }) : t("No conversations yet")}</span>
              </div>
              <div className="admin-row__actions">
                <button type="button" className="text-button" aria-expanded={open} onClick={() => setOpenId(open ? null : person.id)}>{t(open ? "Close" : "Open")}</button>
              </div>
              {open && <PersonPanel person={person} onSaved={load} />}
            </li>
          );
        })}
      </ul>
    </section>
  );

  function formatDay(value: string) {
    return formatInZone(`${value}T12:00:00.000Z`, locale, { day: "numeric", month: "short" });
  }
}

function PersonPanel({ person, onSaved }: { person: TeamPerson; onSaved: () => Promise<void> }) {
  const { t, locale } = useLocale();
  const [editing, setEditing] = useState<Conversation | null>(null);
  const day = (value: string) => formatInZone(`${value}T12:00:00.000Z`, locale, { day: "numeric", month: "long", year: "numeric" });
  return (
    <div className="person-panel">
      <div className="person-panel__evaluations">
        <h3>{t("Signed check-ins")}</h3>
        {person.signedEvaluations.length
          ? <ul className="signed-list">{person.signedEvaluations.map((item) => <SignedEvaluationCard key={item.cycleId} evaluation={item} />)}</ul>
          : <p className="helper">{t("{name} hasn’t signed any check-in. You can still talk and take notes.", { name: person.name.split(/\s+/)[0] })}</p>}
      </div>
      <div className="person-panel__notes">
        <h3>{t(editing ? "Edit conversation" : "Record a conversation")}</h3>
        <ConversationForm key={editing?.id ?? "new"} person={person} editing={editing} onDone={async () => { setEditing(null); await onSaved(); }} onCancel={editing ? () => setEditing(null) : undefined} />
        {person.conversations.length > 0 && (
          <ol className="conversation-list">
            {person.conversations.map((item) => (
              <li className="conversation-card" key={item.id}>
                <p className="conversation-card__meta"><time dateTime={item.heldOn}>{day(item.heldOn)}</time></p>
                <p className="conversation-card__notes">{item.notes}</p>
                <button type="button" className="text-button" onClick={() => setEditing(item)}>{t("Edit")}</button>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}

function ConversationForm({ person, editing, onDone, onCancel }: { person: TeamPerson; editing: Conversation | null; onDone: () => Promise<void>; onCancel?: () => void }) {
  const { t } = useLocale();
  const toast = useToast();
  const id = useId();
  const [heldOn, setHeldOn] = useState(editing?.heldOn ?? today());
  const [notes, setNotes] = useState(editing?.notes ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true); setError("");
    try {
      if (editing) await api(`/api/coordinator/conversations/${editing.id}`, { method: "PATCH", body: JSON.stringify({ heldOn, notes }) });
      else await api("/api/coordinator/conversations", { method: "POST", body: JSON.stringify({ employeeUserId: person.id, heldOn, notes }) });
      if (!editing) setNotes("");
      toast(t("Conversation saved. {name} can see the notes now.", { name: person.name.split(/\s+/)[0] }));
      await onDone();
    } catch (caught) {
      setError(errorText(caught, "Something went wrong. Please try again."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="conversation-form" onSubmit={submit}>
      <label className="field" htmlFor={`${id}-date`}>
        <span>{t("Date")}</span>
        <input id={`${id}-date`} type="date" value={heldOn} max={today()} required onChange={(event) => setHeldOn(event.target.value)} />
      </label>
      <label className="comment-field" htmlFor={`${id}-notes`}>
        <span>{t("What did you agree on? How can each of you work on it?")}</span>
        <textarea id={`${id}-notes`} value={notes} required maxLength={20_000} onChange={(event) => setNotes(event.target.value)} />
      </label>
      <p className="helper">{t("{name} sees these notes on their home page.", { name: person.name.split(/\s+/)[0] })}</p>
      <ErrorMessage message={error} />
      <div className="admin-form__actions">
        <Primary busy={busy} disabled={!notes.trim()}>{t(busy ? "Saving…" : editing ? "Save changes" : "Save conversation")}</Primary>
        {onCancel && <button type="button" className="text-button" onClick={onCancel}>{t("Cancel")}</button>}
      </div>
    </form>
  );
}
