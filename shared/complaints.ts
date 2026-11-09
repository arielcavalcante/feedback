// "Reclamar" topics. Leadership is intentionally absent: feedback about coordination goes through the weekly survey.
export const COMPLAINT_TOPICS = [
  { key: "equipment", label: "Machine & equipment" },
  { key: "software", label: "Software & tools" },
  { key: "colleagues", label: "Colleagues" },
  { key: "working_conditions", label: "Working conditions" },
  { key: "infrastructure", label: "Infrastructure" },
  { key: "office_return", label: "End of home office" },
  { key: "processes", label: "Processes & bureaucracy" },
  { key: "workload", label: "Workload & deadlines" },
  { key: "communication", label: "Communication" },
  { key: "other", label: "Other" },
] as const;

export type ComplaintTopic = (typeof COMPLAINT_TOPICS)[number]["key"];
export const COMPLAINT_TOPIC_KEYS: readonly string[] = COMPLAINT_TOPICS.map((topic) => topic.key);
/** Generous safety cap; the UI shows no limit. */
export const COMPLAINT_MAX_LENGTH = 50_000;
