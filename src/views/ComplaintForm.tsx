import { type FormEvent, useEffect, useId, useRef, useState } from "react";
import { api } from "../api";
import { useLocale } from "../i18n";
import { ErrorMessage, errorText, Primary, SignToggle } from "../components/ui";
import { COMPLAINT_MAX_LENGTH, COMPLAINT_TOPICS } from "../../shared/complaints";

export function ComplaintForm({ coordinatorName, onSent, onCancel }: {
  coordinatorName: string;
  onSent: (signed: boolean) => void;
  onCancel: () => void;
}) {
  const { t } = useLocale();
  const id = useId();
  const [topics, setTopics] = useState<string[]>([]);
  const [text, setText] = useState("");
  const [signed, setSigned] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => { formRef.current?.scrollIntoView({ block: "start", behavior: "smooth" }); }, []);

  function toggle(key: string) {
    setTopics((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key]);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/api/employee/complaints", { method: "POST", body: JSON.stringify({ topics, body: text, signed }) });
      onSent(signed);
    } catch (caught) {
      setError(errorText(caught, "Unable to send your complaint."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form ref={formRef} className="complaint-form" onSubmit={submit} aria-labelledby={`${id}-title`}>
      <div>
        <p className="eyebrow">{t("Complain")}</p>
        <h2 id={`${id}-title`}>{t("Go ahead, vent")}</h2>
        <p className="active-feedback__intro">{t("Pick one or more topics and write as much as you want. To talk about your coordinator, use the weekly check-in.")}</p>
      </div>

      <fieldset className="topic-options">
        <legend>{t("What is it about?")}</legend>
        {COMPLAINT_TOPICS.map((topic) => (
          <button key={topic.key} type="button" aria-pressed={topics.includes(topic.key)} onClick={() => toggle(topic.key)}>{t(topic.label)}</button>
        ))}
      </fieldset>

      <label className="comment-field complaint-form__text" htmlFor={`${id}-text`}>
        <span>{t("What’s bothering you?")}</span>
        <textarea id={`${id}-text`} value={text} maxLength={COMPLAINT_MAX_LENGTH} required onChange={(event) => setText(event.target.value)} />
      </label>

      <SignToggle checked={signed} onChange={setSigned} label={t("Sign with my name")} />
      <p className="helper complaint-form__privacy">
        {signed
          ? t("{name} sees your name and this complaint right away.", { name: coordinatorName })
          : t("Anonymous: {name} only reads the week’s anonymous complaints on Monday, and only if at least 3 people complained. Who wrote what never shows.", { name: coordinatorName })}
      </p>

      <ErrorMessage message={error} />
      <div className="complaint-form__actions">
        <Primary busy={busy} disabled={!topics.length || !text.trim()}>{t(busy ? "Sending…" : "Send complaint")}</Primary>
        <button type="button" className="text-button" onClick={onCancel}>{t("Cancel")}</button>
      </div>
    </form>
  );
}
