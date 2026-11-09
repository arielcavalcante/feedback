import { useLocale } from "../i18n";
import { formatInZone } from "./ui";
import type { SignedEvaluation } from "../types";

export function SignedEvaluationCard({ evaluation }: { evaluation: SignedEvaluation }) {
  const { t, locale } = useLocale();
  return (
    <li className="signed-card">
      <p className="signed-card__week">{t("Week of {date}", { date: formatInZone(evaluation.weekStart, locale, { day: "numeric", month: "short" }) })}</p>
      <dl className="signed-card__scores">
        <div><dt>{t("Coordinator")}</dt><dd>{evaluation.coordinator}</dd></div>
        <div><dt>{t("Team")}</dt><dd>{evaluation.team}</dd></div>
        <div><dt>{t("Work")}</dt><dd>{evaluation.work}</dd></div>
      </dl>
      {evaluation.comment && <p className="signed-card__comment">{evaluation.comment}</p>}
    </li>
  );
}
