# Privacy and anonymity requirements

Anonymous feedback is the central product promise. “Anonymous” here means the system may confidentially retain attribution for eligibility, deduplication, reminders, integrity, and tightly controlled investigations, while coordinators, employees, ordinary administrators, reports, logs, and emails cannot identify or reasonably infer a respondent.

This model must be reviewed with the organization's legal/privacy owner before production use. Product copy must describe the implementation accurately; do not claim technically irreversible anonymity unless the design actually provides it.

## Actors and trust boundaries

- **Employee:** may submit their eligible survey once and see only `done`/`skipped` status for their own past cycles.
- **Coordinator:** may see authorized team-level results only after privacy checks; never respondent attribution.
- **Admin:** may manage users/teams/roles but has no survey-content access by default.
- **Privacy administrator:** optional named, least-privilege operational role for exceptional investigations; not part of ordinary UI.
- **Worker/API:** trusted enforcement boundary for identity, authorization, eligibility, privacy thresholds, and response minimization.
- **Browser, email provider, analytics, logs:** untrusted for raw survey attribution/content and receive the minimum necessary data.

## Non-negotiable invariants

1. Coordinator-facing API responses contain no respondent user ID, participant ID, submission ID, email, identity claim, IP address, user agent, or exact submission timestamp.
2. An aggregate cohort is hidden unless its eligible submitted-response count meets the cycle's threshold snapshot, default `3`.
3. Qualitative comments/topics obey the same threshold and additional anti-identification checks; a single comment is never labeled as one person's response.
4. Filters cannot reduce a visible cohort below threshold. Combining endpoints, neighboring cycles, dimensions, topics, exports, or meeting context must not enable differencing attacks.
5. Results are authorized by server-side current/historical team assignment. Client-side role checks are presentation only.
6. An employee meeting view may show only privacy-approved team-level signals and must not select, imply, or narrate a response as that employee's.
7. The employee history projection contains only past cycle label/date and `done`/`skipped`.
8. Logs, traces, analytics, error reports, emails, and support tooling contain no raw answer text, numeric response values linked to identity, identity tokens, or hidden attribution.
9. Ordinary admin features cannot access raw submissions/answers.
10. Privacy-sensitive access and configuration changes are audited without copying sensitive content into the audit trail.

## Threshold and cohort policy

- Default minimum: three eligible submitted responses for the exact team/cycle report cohort.
- Snapshot the threshold on cycle creation; increases may be applied defensively, but never retroactively lower protection without an explicit reviewed migration.
- If the threshold is not met, return a generic `insufficient_responses` state and no dimension aggregates, comments, topics, counts more precise than policy permits, or comparison deltas.
- Do not reveal which employee skipped. Coordinator report copy should say only that results are unavailable due to insufficient participation.
- Team changes during a cycle do not alter its eligibility snapshot.
- Decide before launch whether very small teams are excluded, combined into an approved larger cohort, or receive no report. Do not silently pool across coordinators.

## Qualitative safeguards

Free text carries re-identification risk even above a numeric threshold.

- Warn employees not to include names, client identifiers, secrets, health details, or uniquely identifying events.
- Apply length limits and safe rendering/escaping.
- Define moderation/reporting and harmful-content handling before launch.
- Consider showing themes or paraphrases only after human/privacy review; automated summarization is out of MVP scope.
- Avoid exposing exact ordering or timestamps. Shuffle or use stable non-chronological ordering.
- If a comment is obviously self-identifying, withhold it or route it through the approved privacy process rather than exposing attribution.
- Topic filters must preserve the original eligible cohort threshold; do not reveal per-topic counts when sparse.

## Authentication and authorization

- Cloudflare Access validates Microsoft Entra identity before protected traffic reaches the Worker; the Worker still verifies the trusted Access token/assertion and maps a stable tenant-scoped claim to an active local user.
- Allow only the approved Entra tenant/domain and require appropriate organization security policy (MFA/Conditional Access as decided by IT).
- Application RBAC is separate from Access admission. Every API route checks active user, role, team scope, and resource ownership.
- Direct-object-reference tests cover guessed IDs across users, teams, cycles, meetings, and action items.
- Local-development bypasses use explicit development-only configuration and cannot be enabled in deployed production.
- Define a break-glass process with time-bounded access and audit review.

## Data minimization, retention, and deletion

Retention is unresolved and must be approved before launch. Set separate periods for:

- Identity and membership history.
- Attribution/participant data.
- Quantitative answers and aggregates.
- Qualitative text/topics.
- Meeting notes/outcomes/action items.
- Audit and delivery logs.

Prefer the shortest useful periods, especially for free text and attribution. A deletion/export request process must explain where deletion is restricted by employment/legal/audit obligations. Deactivation must stop access without corrupting historical aggregate integrity. Backups must expire under the same documented policy.

## Operational controls

- Production database/export access is limited to named operators and reviewed periodically.
- No production data is copied into local or preview environments.
- Secrets live in managed secret stores and are rotated after suspected exposure.
- Database backups/exports are encrypted and access-logged.
- Monitoring favors counts and reason codes over payloads.
- Incident response includes containment, access-log review, affected-scope analysis, notification ownership, and credential rotation.
- Dependency, Worker, D1, Resend, and Access configuration changes receive review appropriate to risk.

## Threat scenarios and required mitigations

| Scenario | Required mitigation |
|---|---|
| Coordinator guesses who submitted from time | Omit exact times and participation identities; generic insufficient state |
| Two filters reveal one person's answer by subtraction | Central cohort engine; threshold on every projection and comparison; disallow unsafe filters |
| Admin opens raw-answer endpoint | No ordinary endpoint/capability exists; exceptional access is separate, named, and audited |
| Browser bundle/query contains hidden attribution | Server-side projection; contract tests and payload inspection |
| Logs capture a comment or Access token | Structured allowlist logging, redaction, and automated tests |
| Reminder email reveals participation | Send only to the recipient; generic content; no CC/list; idempotent jobs |
| Meeting view implies an employee wrote a comment | Only team-level eligible signals; no response selection linked to meeting subject |
| Membership change rewrites eligibility | Immutable cycle participant snapshot |
| Scheduler retry sends duplicate report/reminder | Unique idempotency keys and transactional claiming |
| Self-identifying free text exposes respondent | Warning, moderation/withholding rules, no timestamps/order cues |

## Privacy release checklist

- Privacy/legal owner approves notice, purposes, access model, retention, deletion, and investigation procedure.
- IT approves Entra/Access configuration and stable identity mapping.
- Automated tests cover threshold `n-1`, `n`, and `n+1`, cross-team access, differencing attempts, serialization, and log redaction.
- Manual inspection confirms coordinator and employee network payloads contain only permitted fields.
- Small-team behavior and qualitative moderation are tested with realistic scenarios.
- Production support and database access lists are documented and approved.
- Participants are told who can access what, how status/reminders work, and where to report a concern.
