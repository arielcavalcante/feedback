# Proposed D1 data model

This is a logical schema for design and issue planning, not a committed migration. Use text UUID/ULID identifiers, ISO-8601 UTC instants, explicit foreign keys, and D1-supported constraints/indexes. Drizzle should generate migrations checked into source control.

## Modeling principles

- Identity and organization tables are separate from confidential survey content.
- Authorization is derived server-side from active assignments, never client claims alone.
- A cycle snapshots employee eligibility so later membership edits do not rewrite history.
- Submission attribution exists only for tracking and integrity. Reporting reads must go through a threshold-enforcing service/query boundary.
- Future cycles are calculated, not pre-created as employee status records.
- Delete behavior normally restricts or archives; historical records should not silently cascade away.

## Identity and organization

### `users`

| Column | Notes |
|---|---|
| `id` | Primary key |
| `email` | Normalized login/contact email; unique case-insensitively |
| `display_name` | Current display name |
| `is_active` | Application access flag |
| `created_at`, `updated_at`, `deactivated_at` | UTC audit timestamps |

The immutable internal `id`, not email, owns relationships. Email changes require a separate verified workflow and must not rewrite historical ownership.

### `auth_credentials`

One current password credential per user. Columns: `user_id` (primary/foreign key), `password_hash` (self-describing/versioned encoded hash), `password_changed_at`, optional `must_change_password`, `created_at`, `updated_at`.

Never store plaintext or reversibly encrypted passwords. Prefer Argon2id if the Worker spike proves it practical. The fallback is PBKDF2-HMAC-SHA-256 using Workers Web Crypto, a unique random salt per password, versioned parameters, and a work factor benchmarked in production-like Workers. A pepper, if used, lives only in a Worker secret and is versioned for rotation.

### `account_invitations`

Columns: `id`, `user_id`, `email_snapshot`, `token_digest` (unique), `expires_at`, optional `accepted_at`, optional `revoked_at`, `created_by_user_id`, `created_at`.

Generate at least 32 random bytes with a cryptographically secure generator. Email only an HTTPS URL containing the opaque token. Store only a SHA-256 digest because the token has high entropy. The email shown on the acceptance page comes from the server-side record and is read-only; do not put the email in the URL. A transaction/conditional update makes acceptance single-use.

### `auth_sessions`

Columns: `id`, `user_id`, `token_digest` (unique), `created_at`, `last_seen_at`, `expires_at`, optional `revoked_at`, optional `replaced_by_session_id`, optional `ip_hash`, optional `user_agent_summary`.

The browser receives the opaque token only in a `Secure`, `HttpOnly`, `SameSite=Lax`, path-scoped cookie. Rotate on login and privilege-sensitive events; revoke on logout, password change/reset, user deactivation, and suspected compromise. Store only a digest and enforce absolute plus idle expiry.

### `password_reset_tokens`

Columns: `id`, `user_id`, `token_digest` (unique), `expires_at`, optional `used_at`, optional `revoked_at`, `created_at`.

Use the same high-entropy, digest-only, fixed-origin, single-use rules as invitations. Reset requests return a generic response regardless of whether the account exists.

### `auth_rate_limits`

Columns: `key_hash`, `action`, `window_started_at`, `attempts`, optional `blocked_until`, `updated_at`; composite primary key on `(key_hash, action)`.

Rate-limit keys are one-way digests derived from normalized identity or request IP plus a secret pepper, so D1 does not become a raw email/IP attempt log. Login and password recovery have independent limits. Successful login clears the identity bucket; stale buckets are periodically deleted.

### `roles`

Seeded lookup table: `admin`, `coordinator`, `employee`.

Columns: `id`, `key` (unique), `name`, `description`.

### `user_roles`

Columns: `user_id`, `role_id`, `granted_at`, `granted_by_user_id`, optional `revoked_at`. Unique active assignment per user/role. A join table is required because users may have multiple roles.

### `teams`

Columns: `id`, `name`, optional `description`, `is_active`, `created_at`, `updated_at`.

### `team_members`

Columns: `id`, `team_id`, `user_id`, `starts_at`, optional `ends_at`, `created_at`, `created_by_user_id`.

Index current membership by `(team_id, ends_at)` and user by `(user_id, ends_at)`. Prevent invalid/overlapping active assignments according to the chosen multi-team policy.

### `team_coordinators`

Columns: `id`, `team_id`, `user_id`, `starts_at`, optional `ends_at`, `is_primary`, `created_at`, `created_by_user_id`.

Coordinator role and team assignment are both required for coordinator capabilities. Multiple assignments are structurally supported; one primary coordinator is used for MVP cycle snapshots.

### `holidays`

Columns: `local_date` (primary key), `name`, `scope` (`national`, `state`, `fortaleza`, `company`), `created_at`.

The scheduler treats Monday–Friday dates absent from this table as workdays. Holiday data changes email dates only: employee mail moves backward from a holiday Friday and coordinator mail moves forward from a holiday Monday. Survey open/close/report instants remain anchored. Review and load each year's official calendar before that year begins.

## Feedback cycle

### `feedback_schedules`

Recommended configuration table even if the MVP has one schedule.

Columns: `id`, `name`, `timezone` (default `America/Fortaleza`), `anchor_open_local_date`, `interval_days` (default `14`), `open_local_time` (`09:00`), `close_local_time` (`23:59:59`), `report_local_time` (`09:00`), `anonymity_threshold` (default `3`, check `>= 3`), `is_active`, `created_at`, `updated_at`.

The report date is the Monday following close. A frequent UTC cron asks the application which transition is due. The scheduler uses a transaction/idempotency key, not cron timing, for exactly-once logical behavior.

### `feedback_cycles`

Columns: `id`, `schedule_id`, `sequence_number`, `opens_at`, `closes_at`, `report_at` (UTC), `status` (`scheduled`, `open`, `closed`, `reported`, `cancelled`), `anonymity_threshold_snapshot`, `created_at`, `opened_at`, `closed_at`, `reported_at`.

Unique: `(schedule_id, sequence_number)` and optionally each transition idempotency key. The threshold is copied from the schedule so historical rules do not change retroactively.

### `feedback_cycle_participants`

Required eligibility snapshot, though omitted from the user's minimum entity list.

Columns: `id`, `cycle_id`, `employee_user_id`, `team_id`, `coordinator_user_id`, `eligibility_status` (`eligible`, `excluded`), optional `exclusion_reason`, `created_at`.

Unique: `(cycle_id, employee_user_id, team_id)`. This table supports reminders and `skipped` history without querying mutable memberships. Access to it is confidential because it can reveal participation context.

### `feedback_submissions`

Columns: `id`, `cycle_id`, `participant_id`, `submitted_at`, `state` (`submitted`, `withdrawn` if policy permits), `schema_version`, optional `confidential_lookup_key`, `created_at`.

Unique active submission per participant. Do not expose `participant_id`, exact `submitted_at`, or lookup keys to coordinators. Consider separating attribution from content into different repository modules or tables if operational access controls justify it.

### `feedback_answers`

Columns: `id`, `submission_id`, `dimension` (`coordinator`, `team`, `work`), `question_key`, optional `numeric_value`, optional `text_value`, `created_at`.

Checks enforce the expected value type and rating range for each versioned question. Qualitative text is especially sensitive. Ordinary employee history queries must never join this table.

### `topics`

Columns: `id`, `key` (unique), `label`, `is_active`, `created_at`, `updated_at`.

### `feedback_answer_topics`

Columns: `feedback_answer_id`, `topic_id`; composite primary key. If topics apply to a whole submission instead, use `feedback_submission_topics` and document the choice.

## Meetings and follow-through

### `meetings`

Columns: `id`, `employee_user_id`, `coordinator_user_id`, optional `team_id`, `scheduled_for`, optional `held_at`, `status` (`planned`, `completed`, `cancelled`), optional `context_summary`, `created_at`, `updated_at`.

Access is limited to the employee, assigned/recorded coordinator, and explicitly authorized administrators. `context_summary` must not copy or attribute anonymous answers.

### `meeting_assessments`

Columns: `id`, `meeting_id`, `dimension_key`, `rating`, optional `note`, `visibility` (`employee_and_coordinator`, `coordinator_only` only if policy approves), `created_by_user_id`, `created_at`, `updated_at`.

These are development pulses/ratings, not NPS and not feedback survey answers.

### `action_items`

Columns: `id`, `meeting_id`, `owner_user_id`, `title`, optional `description`, optional `due_at`, `status` (`open`, `done`, `cancelled`), `visibility`, `created_by_user_id`, `created_at`, `updated_at`, optional `completed_at`.

Recognition and growth opportunities may start as typed meeting outcomes or receive dedicated tables if product behavior diverges. Prefer explicit structured fields over overloading survey answers.

### `meeting_outcomes`

Recommended supporting table.

Columns: `id`, `meeting_id`, `kind` (`recognition`, `growth_opportunity`, `summary`), `content`, `visibility`, `created_by_user_id`, `created_at`, `updated_at`.

## Delivery and audit

### `email_jobs`

Columns: `id`, `job_type` (`account_invitation`, `password_reset`, `feedback_reminder`, `coordinator_report_ready`), optional `cycle_id`, `recipient_user_id`, `scheduled_for`, `status` (`pending`, `processing`, `sent`, `failed`, `cancelled`), `attempt_count`, `idempotency_key` (unique), optional `provider_message_id`, optional `last_error_code`, optional `last_error_at`, `created_at`, `updated_at`, optional `sent_at`.

Do not store rendered survey content in this table. Errors must be scrubbed of provider payloads that contain personal data.

### `audit_logs`

Columns: `id`, `occurred_at`, optional `actor_user_id`, `action`, `resource_type`, optional `resource_id`, `outcome`, optional `reason_code`, optional `request_id`, optional `ip_hash`, optional `metadata_json`.

Append-only at the application layer. Never log answer text, numeric answers, raw identity headers/tokens, full IP addresses, or provider secrets. Access to audit logs is privileged and audited.

## Employee history contract

Employee history is a deliberately minimized projection, not a survey archive. For every closed past cycle in which the employee was eligible, return:

```ts
type EmployeeCycleHistoryItem = {
  cycleId: string;
  label: string;
  closedAt: string;
  status: "done" | "skipped";
};
```

`done` means an eligible submitted record exists; `skipped` means it does not. The endpoint must not return answers, scores, comments, topics, submission IDs, exact submission time, coordinator report state, aggregate values, or future cycles. Prefer deriving this projection from `feedback_cycle_participants` + `feedback_cycles` + submission existence rather than persisting a second user-visible status that may drift.

## Key indexes and constraints

- Unique normalized email; one current credential per user; unique invitation/reset/session token digests.
- Active role, membership, and coordinator assignment indexes.
- Unique schedule/sequence and participant snapshot keys.
- Unique submission per participant and email idempotency key.
- Time/status indexes for due cycles and email jobs.
- Meeting indexes by employee/date and coordinator/date.
- Foreign keys enabled for every D1 connection/migration where supported.
- Checks for rating ranges, threshold minimum, valid intervals, and enum-like values.

## Reporting boundary

Coordinator/reporting code receives only privacy-approved projections grouped by cycle/team. It first computes eligible submitted-response counts, enforces the threshold, and only then returns aggregate dimensions or qualitative material. Raw submissions, answers, participants, and exact timestamps are never returned by coordinator repositories/controllers. Query-shape and differencing tests are mandatory.
