#!/usr/bin/env bash
set -euo pipefail

repo_root="$(git rev-parse --show-toplevel)"
cd "$repo_root"

gh auth status -h github.com >/dev/null
gh repo view >/dev/null

create_label() {
  local name="$1" color="$2" description="$3"
  gh label create "$name" --color "$color" --description "$description" --force >/dev/null
}

create_label foundation 5319E7 "Project foundations and tooling"
create_label auth 0E8A16 "Authentication and authorization"
create_label data 1D76DB "Database and data model"
create_label admin C5DEF5 "Administration experience"
create_label feedback FBCA04 "Feedback cycle and survey"
create_label privacy B60205 "Privacy or anonymity critical"
create_label email D4C5F9 "Email delivery"
create_label coordinator 006B75 "Coordinator experience"
create_label employee FEF2C0 "Employee experience"
create_label meetings C2E0C6 "Meeting workflows"
create_label operations BFDADC "Operations, deployment, or reliability"
create_label feature A2EEEF "Product or engineering feature"

titles=(
  "Scaffold the Cloudflare React application and CI"
  "Implement invitation-only password authentication and sessions"
  "Design D1 schema and Drizzle migrations"
  "Implement application identity and multi-role authorization"
  "Build audit logging and safe observability foundation"
  "Build admin user and role management"
  "Build admin team, membership, and coordinator management"
  "Implement the biweekly cycle scheduler"
  "Implement employee eligibility and feedback submission"
  "Build the employee done/skipped history grid"
  "Implement privacy-safe aggregate reporting"
  "Add qualitative topics and protected comment display"
  "Implement durable Resend email jobs"
  "Build the coordinator dashboard and trends"
  "Build meeting preparation and outcomes"
  "Build the employee meeting outcomes view"
  "Complete accessibility, responsive, and end-to-end QA"
  "Deploy production with observability and run a privacy-reviewed pilot"
  "V1.1: Add an employee pre-1:1 agenda"
  "V2: Generate an opt-in recognition share card"
)

labels=(
  "foundation"
  "auth,privacy"
  "data,privacy"
  "auth,privacy"
  "operations,privacy"
  "operations,privacy"
  "meetings,employee,privacy"
  "employee,privacy,feature"
  "admin,auth"
  "admin,auth,data"
  "feedback,operations"
  "feedback,employee,privacy"
  "employee,feedback,privacy"
  "privacy,coordinator,data"
  "privacy,feedback,coordinator"
  "email,operations,privacy"
  "coordinator,feedback,privacy"
  "meetings,coordinator,privacy"
  "meetings,employee,privacy"
  "operations,privacy"
)

existing_titles="$(gh issue list --state all --limit 500 --json title --jq '.[].title')"

body_for() {
  case "$1" in
    01) cat <<'EOF'
## Outcome
A minimal React/TypeScript/Vite application runs on Cloudflare Workers with Static Assets and has a documented local/CI loop.

## Acceptance criteria
- [ ] A fresh clone installs, runs, and tests locally without production secrets.
- [ ] The Worker serves the application and a versioned health endpoint.
- [ ] CI runs type checking, linting, tests, build, and migration validation.
- [ ] Local, preview, and production configuration boundaries are documented.
EOF
    ;;
    02) cat <<'EOF'
## Outcome
Admins can invite a pre-created user; the user follows a single-use link with a server-bound locked email, creates a safely stored password, and uses a secure session.

## Acceptance criteria
- [ ] Invite/reset links carry only a cryptographically random opaque token; D1 stores its digest, binding, expiry, and single-use state.
- [ ] The acceptance page resolves the email server-side and renders it read-only; edited URL/form email values have no authority.
- [ ] Argon2id is benchmarked in a production-like Worker; if unsuitable, versioned PBKDF2-HMAC-SHA-256 parameters are benchmarked and documented.
- [ ] Password plaintext never enters D1, logs, analytics, email jobs, or errors; salts are unique and any pepper is a Worker secret.
- [ ] Sessions use random digest-only tokens and Secure, HttpOnly, SameSite cookies with rotation, expiry, logout, reset/change, and deactivation revocation.
- [ ] Login/invite/reset use generic errors, fixed HTTPS origins, no-referrer/no-store policy, CSRF/origin defenses, and rate limiting/backoff.
- [ ] Without MFA, passwords require at least 15 characters, support at least 128 plus Unicode/whitespace/paste, are not silently truncated, and are checked against a safe common/breached-password blocklist.
- [ ] Bootstrap-admin recovery and an MFA follow-up for privileged accounts are documented.
EOF
    ;;
    03) cat <<'EOF'
## Outcome
Create the reviewed D1/Drizzle schema and migration workflow described in `docs/DATA_MODEL.md`.

## Acceptance criteria
- [ ] Migrations create organization, auth, cycle, confidential survey, meeting, email, and audit tables from an empty D1 database.
- [ ] Credentials are versioned hashes; invite/reset/session tokens are unique digests with expiry/revocation fields.
- [ ] Constraints prevent duplicate participants, submissions, transitions, active roles, and email idempotency keys.
- [ ] Synthetic seeds cover multi-role, inactive, small-team, threshold-edge, expired-token, and revoked-session cases.
- [ ] CI validates migrations from scratch and detects schema drift.
EOF
    ;;
    04) cat <<'EOF'
## Outcome
Every protected API resolves a valid active session and enforces multi-role, team/resource-scoped authorization.

## Acceptance criteria
- [ ] Unknown, inactive, expired, revoked, or malformed sessions receive no protected data.
- [ ] Role capabilities and coordinator/team scope are enforced server-side; browser guards are presentation only.
- [ ] Tests deny cross-user/team access, guessed IDs, stale assignments, forged cookies, and CSRF attempts.
- [ ] Password changes/resets and user deactivation revoke applicable sessions.
EOF
    ;;
    05) cat <<'EOF'
## Outcome
Operators can diagnose and audit the service without telemetry becoming a data leak.

## Acceptance criteria
- [ ] Logs exclude answers, passwords, token/cookie values, secrets, raw email links, and full IP addresses.
- [ ] Sensitive role/team/auth/privacy/meeting actions produce content-free append-only audit events.
- [ ] Sentinel tests prove redaction across expected failure paths.
- [ ] Metrics avoid personal/high-cardinality labels and privileged audit access is controlled.
EOF
    ;;
    06) cat <<'EOF'
## Outcome
Admins safely manage users, activation, roles, and account invitations without survey-content access.

## Acceptance criteria
- [ ] Admins create/update users, assign multiple roles, deactivate/reactivate, send/revoke/resend invitations, and see safe invite state.
- [ ] Duplicate email, inactive targets, expired/reused invites, and unauthorized requests are rejected safely.
- [ ] Resending revokes older active invitations and does not disclose raw token values after enqueue.
- [ ] Admin payloads contain no credential hashes, token digests, sessions, survey data, or meeting content.
- [ ] Mutations are audited and critical/destructive flows are accessible and confirmed.
EOF
    ;;
    07) cat <<'EOF'
## Outcome
Admins manage teams, employee memberships, coordinator assignments, and lifecycle dates with valid historical behavior.

## Acceptance criteria
- [ ] Create/update/deactivate and add/end assignment flows work with audited validation.
- [ ] Application role and team assignment are distinct in API and UI.
- [ ] Invalid dates, inactive entities, prohibited overlaps, and unauthorized access are rejected.
- [ ] Changes affect future eligibility but never rewrite a cycle participant snapshot.
EOF
    ;;
    08) cat <<'EOF'
## Outcome
Cycles transition every 14 days at Fortaleza-local times despite cron retries or delays.

## Acceptance criteria
- [ ] A confirmed anchor yields Friday 09:00 open, Sunday 23:59:59 close, and Monday 09:00 report every 14 days.
- [ ] UTC persistence and timezone-boundary tests cover before/at/after transitions and year rollover.
- [ ] Concurrent/repeated cron calls cannot duplicate cycles, transitions, snapshots, or jobs.
- [ ] Delayed runs recover safely; anchor and holiday behavior are documented.
EOF
    ;;
    09) cat <<'EOF'
## Outcome
Eligible employees submit one validated survey during an open cycle while attribution remains confidential.

## Acceptance criteria
- [ ] Only an eligible active employee can access/submit their current open survey exactly once.
- [ ] Required CSAT scales and optional text/topics are validated, safe-rendered, and accessible.
- [ ] Closed/future/cancelled/cross-user/concurrent attempts are rejected server-side.
- [ ] Answers and attribution never enter logs/analytics/errors; edit/withdraw policy is documented.
EOF
    ;;
    10) cat <<'EOF'
## Outcome
Employees see one accessible grid square per eligible past cycle with only `done` or `skipped`.

## Acceptance criteria
- [ ] The API returns only cycle ID, label/date, close date, and status.
- [ ] No answers, scores, comments, topics, submission metadata, aggregates, or future/open cycles appear.
- [ ] Status is understandable without color; keyboard, screen reader, mobile, empty, and long-history states pass.
- [ ] Contract tests reject forbidden serializer fields.
EOF
    ;;
    11) cat <<'EOF'
## Outcome
One reporting boundary enforces authorization, cohort integrity, threshold protection, and minimized serialization.

## Acceptance criteria
- [ ] Below threshold returns only generic `insufficient_responses`; at/above returns approved aggregates only.
- [ ] Filters, comparisons, trends, exports, endpoint combinations, and caches cannot enable differencing or cross-team leaks.
- [ ] Coordinator payloads structurally exclude respondent/participant/submission IDs and exact times.
- [ ] Tests cover `n-1`, `n`, `n+1`, membership changes, sparse topics, guessed IDs, and differencing.
EOF
    ;;
    12) cat <<'EOF'
## Outcome
Optional topics/comments are useful to coordinators only when cohort and content safeguards permit them.

## Acceptance criteria
- [ ] Inputs are optional, limited, escaped, and excluded from logs/analytics/errors.
- [ ] Threshold/sparse-topic rules, non-chronological display, and forbidden fields prevent identification.
- [ ] Self-identifying/harmful content has an approved report/withhold process and owner.
- [ ] No AI summarization is added in MVP; privacy owners approve presentation before launch.
EOF
    ;;
    13) cat <<'EOF'
## Outcome
Resend reliably delivers invitations, password resets, reminders, and report-ready notices with minimal data.

## Acceptance criteria
- [ ] Unique idempotency keys and atomic claims prevent duplicate logical sends.
- [ ] Transient failures retry with bounded backoff; terminal failures alert safely.
- [ ] Invite/reset messages use fixed HTTPS origins and opaque tokens; survey messages contain no survey content or unsafe participation data.
- [ ] Provider secrets use managed storage; local/CI transports send nothing externally.
EOF
    ;;
    14) cat <<'EOF'
## Outcome
Authorized coordinators understand privacy-safe aggregate CSAT signals and trends.

## Acceptance criteria
- [ ] All data comes from the protected reporting boundary and below-threshold states expose no values/deltas/comments.
- [ ] No browser payload/state contains respondent identity, submission IDs, or exact times.
- [ ] Trends suppress comparisons when either cohort is unsafe.
- [ ] Charts have text equivalents and accessible responsive loading/empty/error states.
EOF
    ;;
    15) cat <<'EOF'
## Outcome
Coordinators prepare for and record one-to-one meetings using prior context and eligible team-level signals.

## Acceptance criteria
- [ ] Meeting authorization handles current/stale assignments and guessed IDs server-side.
- [ ] Anonymous survey information appears only as a whole approved team projection, never as the employee's response.
- [ ] Coordinators record development pulses, recognition, growth opportunities, and owned/due action items—never “NPS.”
- [ ] Edits are audited and concurrency/threshold/forbidden-field cases are tested.
EOF
    ;;
    16) cat <<'EOF'
## Outcome
Employees review their authorized meeting outcomes and action items without anonymous survey content.

## Acceptance criteria
- [ ] Employees access only their own authorized records; coordinator-only fields are server-filtered.
- [ ] Responses include approved outcomes/actions but no survey aggregate, answer, comment, topic, or respondent metadata.
- [ ] Action update ownership is explicit and tested.
- [ ] Responsive, keyboard, screen-reader, and contract tests pass.
EOF
    ;;
    17) cat <<'EOF'
## Outcome
Critical experiences are accessible, responsive, and covered by end-to-end privacy/auth tests.

## Acceptance criteria
- [ ] Role, cross-team/object, threshold/differencing, schedule, job, auth-token, session, and log-redaction cases pass.
- [ ] Critical flows meet WCAG 2.2 AA expectations across the supported browser/viewport matrix.
- [ ] Payload inspection confirms forbidden auth/survey fields are absent.
- [ ] No documented release-blocking defect remains.
EOF
    ;;
    18) cat <<'EOF'
## Outcome
Launch an observable, recoverable MVP through a privacy-reviewed pilot.

## Acceptance criteria
- [ ] Production D1/Worker/domain/secrets/migrations/Resend/rate limits/deploy/rollback are verified.
- [ ] Safe dashboards and alerts cover auth, API, scheduler, email, D1, and Worker failures.
- [ ] Backup/restore, incident response, bootstrap/break-glass admin, and privileged access have tested runbooks and owners.
- [ ] Privacy/People approve notice, threshold, free text, retention, auth/session, and meeting policy.
- [ ] One pilot cycle and meeting follow-through completes before wider rollout.
EOF
    ;;
    19) cat <<'EOF'
## Outcome
V1.1 lets employees prepare and intentionally share an attributed one-to-one agenda.

## Acceptance criteria
- [ ] Employees create/edit/order/delete private drafts and explicitly share selected items.
- [ ] Shared agenda is clearly attributed and never mixed with anonymous survey data.
- [ ] Cross-user/team/stale-coordinator access is denied; retention/edit/audit policy is documented.
- [ ] The flow is responsive and accessible.
EOF
    ;;
    20) cat <<'EOF'
## Outcome
V2 lets an employee optionally generate and download/share a safe recognition card.

## Acceptance criteria
- [ ] Generation and any external sharing are separate explicit employee actions.
- [ ] Only approved employee-visible recognition enters the card; survey/private/team/client data is excluded.
- [ ] Preview/edit/approval, accessibility, brand/privacy review, retention, abuse, and cost limits are documented.
- [ ] Tests prevent private fields from prompts, images, metadata, logs, and analytics.
EOF
    ;;
  esac
}

for index in "${!titles[@]}"; do
  number="$(printf '%02d' "$((index + 1))")"
  title="${titles[$index]}"
  if grep -Fqx "$title" <<<"$existing_titles"; then
    echo "Exists: $title"
  else
    gh issue create --title "$title" --label "${labels[$index]}" --body "$(body_for "$number")"
  fi
done
