import { type ReactNode, useId } from "react";
import { useLocale } from "../i18n";

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return `${parts[0][0]}${parts.length > 1 ? parts.at(-1)?.[0] ?? "" : ""}`.toLocaleUpperCase("pt-BR");
}

export function Primary({ busy, disabled, children }: { busy?: boolean; disabled?: boolean; children: ReactNode }) {
  return (
    <button className="case-link primary" disabled={busy || disabled} aria-busy={busy}>
      <span>{children}</span><span className="case-link__icon" aria-hidden="true" />
    </button>
  );
}

export function ErrorMessage({ message }: { message: string }) {
  const { t } = useLocale();
  return message ? <p className="error" role="alert">{t(message)}</p> : null;
}

export function errorText(caught: unknown, fallback: string) {
  return caught instanceof Error ? caught.message : fallback;
}

export function Field(props: {
  label: string;
  type: string;
  value: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
  autoComplete?: string;
  hint?: string;
  minLength?: number;
  maxLength?: number;
  required?: boolean;
}) {
  const { label, hint, onChange, required = true, ...inputProps } = props;
  const { t } = useLocale();
  const id = useId();
  return (
    <label className="field" htmlFor={id}>
      <span>{label}</span>
      <input
        id={id}
        {...inputProps}
        required={required}
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

/** Formats an instant for display in the product's fixed schedule time zone. */
export function formatInZone(value: string, locale: string, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "pt-BR", { timeZone: "America/Fortaleza", ...options }).format(new Date(value));
}
