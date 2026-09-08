# Roadmap

Each phase should leave the system demonstrable and preserve the privacy invariants in `docs/PRIVACY.md`. Issue-sized work is listed in `docs/GITHUB_ISSUES.md`.

## Phase 0 — Foundations and risk spikes

### Deliverables

- React/TypeScript/Vite app served by a Cloudflare Worker with Static Assets.
- Local, preview, and production environment conventions.
- Minimal CI for type checking, linting, tests, and migration checks.
- Proof of concept for Entra ID through Cloudflare Access.
- Written decisions for identity mapping, cycle anchor, retention, and privileged access.

### Acceptance criteria

- A fresh clone can run locally from documented commands without production credentials.
- A preview deployment serves the UI and a health endpoint.
- CI blocks type, lint, unit-test, and migration failures.
- The auth spike demonstrates a verified identity reaching the Worker, documents local-development bypass rules, and fails closed when identity is absent or invalid.
- No product feature implementation is required beyond the vertical slice.

## Phase 1 — Identity, authorization, and data foundation

### Deliverables

- D1 schema and Drizzle migrations for the entities in `docs/DATA_MODEL.md`.
- Application user resolution from a stable Entra claim.
- Multi-role RBAC enforced in API handlers.
- Audit event foundation and seeded local fixtures.

### Acceptance criteria

- Migrations apply to an empty local database and can be validated in CI.
- Deactivated or unknown users cannot access protected application routes.
- A user with multiple roles can switch capabilities without receiving unauthorized data.
- Authorization tests deny cross-team access and direct-object-reference attempts.
- Sensitive administrative and privacy-relevant actions produce append-only audit events without survey content.

## Phase 2 — Organization administration

### Deliverables

- Admin CRUD for users and teams.
- Role, team membership, and coordinator assignment workflows.
- Activation/deactivation and effective-date handling where required.

### Acceptance criteria

- Admins can create/update users and teams, assign multiple roles, manage membership/coordinators, and deactivate/reactivate users.
- Referential and business rules prevent orphaned teams and invalid overlapping assignments.
- Deactivation revokes application access while preserving historical integrity.
- Ordinary admin APIs do not return raw survey answers or attribution.

## Phase 3 — Feedback cycle and employee experience

### Deliverables

- Database-backed 14-day recurrence and idempotent scheduler.
- Employee eligibility snapshot and survey submission.
- CSAT dimensions for coordinator, team, and work, plus optional text/topics.
- Past-cycle `done`/`skipped` grid.

### Acceptance criteria

- Given an anchor cycle, the application opens/closes/reports at the specified Fortaleza-local times while cron may run more frequently in UTC.
- Scheduler retries cannot create duplicate cycles or jobs.
- An eligible employee can submit exactly once during an open cycle; validation and concurrency are tested.
- The employee history endpoint returns only past cycle identity/label/date and `done` or `skipped`; it returns no answers, scores, comments, or future-cycle rows.
- The grid is keyboard accessible, responsive, and understandable without color alone.

## Phase 4 — Privacy-safe reporting and email

### Deliverables

- Central privacy query/service boundary enforcing threshold and cohort rules.
- Coordinator aggregate dashboard and trends.
- Safe qualitative comment/theme display.
- Durable Resend job queue with retries and delivery metadata.

### Acceptance criteria

- No coordinator result is returned below the default threshold of three eligible submitted responses.
- Filtering, time-series comparison, comments, topics, timestamps, exports, and endpoint combinations cannot expose a sub-threshold cohort.
- Coordinator APIs never serialize respondent identifiers or linkable submission metadata.
- Email jobs are idempotent, retry with bounded backoff, and never contain survey content or reveal participation to unauthorized recipients.
- Report notifications are withheld or clearly marked insufficient when the threshold is not met.

## Phase 5 — Meetings and development follow-through

### Deliverables

- Coordinator meeting-prep view with prior context, action items, goals, recognition, and eligible team-level signals.
- Meeting outcomes with development pulse/ratings, growth opportunities, recognition, and action items.
- Employee view of their own meeting outcomes.

### Acceptance criteria

- Coordinator access is scoped to current/authorized assignments and includes no attributed or inferable individual survey response.
- Team signals disappear as a whole when privacy rules are not satisfied; the meeting page cannot narrow them to the employee.
- Coordinators can record and revise structured outcomes with an audit trail.
- The employee can see authorized outcomes/action items/recognition but no anonymous survey score, answer, or comment.
- Product language uses “development pulse” or “rating,” never NPS.

## Phase 6 — Hardening and launch

### Deliverables

- End-to-end authorization/privacy tests, accessibility and responsive QA.
- Production deployment, monitoring, alerting, data recovery, and operational runbooks.
- Privacy review and small-team pilot.

### Acceptance criteria

- Automated tests cover all role combinations, cross-team access, threshold edges, schedule boundaries, retry/idempotency, and employee-history minimization.
- Critical flows meet WCAG 2.2 AA expectations and work at supported mobile/desktop sizes.
- Logs/alerts expose failures without personal survey content.
- Backup/recovery and incident procedures are exercised.
- A pilot owner signs off on privacy language, timing, notifications, and administrator responsibilities before organization-wide use.

## V1.1 — Pre-1:1 agenda

### Acceptance criteria

- Employees can prepare agenda items with explicit draft/shared visibility.
- Sharing is an intentional action and does not mix agenda content with anonymous survey answers.
- Retention, editing, and audit behavior are documented.

## V2 — Recognition share card

### Acceptance criteria

- An employee can opt in to generate a congratulation card from approved recognition text.
- Nothing is posted externally without a separate explicit user action.
- The card excludes private team, survey, and meeting data by default and passes accessibility/brand review.
