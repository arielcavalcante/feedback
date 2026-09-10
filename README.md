# Team Feedback

Planning repository for a small internal feedback platform. The product runs a private, recurring feedback process while keeping survey respondents anonymous to coordinators and colleagues.

Development has started. The repository now contains a React/Worker foundation, initial D1/Drizzle schema, invitation-only authentication slice, and schedule/holiday primitives; product dashboards remain phased work.

## Product overview

Every 14 days, employees receive a short survey about their coordinator, team, and work. A cycle opens Friday at 09:00 and closes Sunday at 23:59 in `America/Fortaleza`; eligible coordinator reports are sent Monday at 09:00. Coordinators use anonymous, aggregated signals in team dashboards and in meeting preparation. Employees can review meeting outcomes and a simple history of whether they completed or skipped each past cycle, but never their survey answers or scores.

## Architecture

- React, TypeScript, and Vite for the web interface.
- Brazilian Portuguese as the default interface and transactional-email locale, with the reviewed English copy available through the header language switch.
- Cloudflare Workers with Static Assets for the web app and API.
- Cloudflare D1 for relational storage, preferably accessed through Drizzle ORM.
- Admin-issued email invitations, password authentication, and server-managed sessions.
- Resend for MVP transactional email.
- Cloudflare Cron Triggers as frequent UTC wake-ups. Application/database logic determines whether a Fortaleza-local event is due; cron expressions do not encode the 14-day recurrence.

The Worker is the authorization and privacy boundary. Browser code must never receive hidden survey attribution or raw answers that it does not need.

The interface follows the visual language of `ariel-portfolio-react`: Clash Grotesk, the same authored color tokens, fixed navigation, mobile menu, locale switch, pill actions, and shared icon assets. The language switch is on for Portuguese, remembers the preference locally, and accepts `?lang=pt-BR` or `?lang=en` for explicit links.

## Roles and capabilities

Users may hold more than one role.

- **Admin:** manage users, teams, memberships, coordinator assignments, roles, and activation. Privileged survey access is not implied by the role.
- **Coordinator:** view threshold-protected aggregate team feedback, trends, eligible comments, meeting context, growth goals, recognition, and action items.
- **Employee:** submit one survey per eligible cycle, see only `done`/`skipped` history for past cycles, and review their own meeting outcomes, action items, and recognition.

## Privacy and anonymity

- Survey attribution may be retained confidentially by the system for eligibility, deduplication, reminders, and abuse/security investigations.
- Coordinators and other employees never receive respondent identity or identity-bearing metadata.
- Aggregate results and comments stay hidden until the eligible submitted-response count reaches the configured threshold (default `3`).
- Small segments, filtering, exports, timestamps, topic combinations, and meeting views must not provide an identification side channel.
- An employee meeting page may use team-level anonymous signals, but never an answer inferred or selected as belonging to that employee.
- Privileged access is least-privilege, audited, purpose-limited, and not exposed through ordinary admin screens.

See [docs/PRIVACY.md](docs/PRIVACY.md) for the enforceable rules and threat model.

## Feedback cycle

1. A due cycle opens Friday at 09:00 `America/Fortaleza`.
2. Eligible employees submit quantitative CSAT answers for coordinator, team, and work, with optional qualitative text/topics.
3. The cycle closes Sunday at 23:59:59 local time. Missing eligible submissions become `skipped` for history/reporting.
4. Monday at 09:00 local time, a coordinator report job is queued. Results are shown only when the anonymity threshold is met.
5. Future cycles are computed schedules, not stored employee history rows. The employee grid renders one square per past cycle with exactly `done` or `skipped`.

All persisted instants use UTC. The recurrence anchor and IANA time zone are stored so daylight-saving/time-zone rules remain explicit even though Fortaleza currently does not observe DST.

## MVP scope

- Single-use email invitations, safe password storage, session authentication, password reset, and application RBAC.
- Admin CRUD for users, roles, teams, memberships, coordinator assignments, and activation.
- D1/Drizzle schema, migrations, seed data, and local development workflow.
- Biweekly cycle scheduling, survey submission, status-only employee history, reminder/report email jobs, and retry handling.
- Threshold-safe coordinator aggregates, trends, and qualitative themes/comments.
- Meeting preparation, meeting outcomes, development pulse/ratings, recognition, growth opportunities, and action items.
- Employee access to their meeting outcomes, action items, and recognition.
- Audit logging, accessibility, responsive behavior, observability, and production runbooks.

## Out of scope for MVP

- Employees viewing their own survey answers, comments, dimension scores, or aggregate scores.
- Individual-level survey analytics or coordinator access to respondent identity.
- AI-generated insights, native mobile apps, public signup, multi-tenant billing, complex org charts, file attachments, and LinkedIn sharing.
- Calling meeting development ratings “NPS.” They are internal development pulses, not Net Promoter Score.

## Later ideas

- **V1.1:** employee-authored pre-1:1 agenda and private talking points, with explicit visibility controls.
- **V2:** optional, consent-based congratulation art suitable for LinkedIn sharing; richer recognition workflows; carefully evaluated assisted theme summarization.

## Local prerequisites

- Node.js 22 LTS (pin the exact version when implementation begins) and a package manager such as pnpm.
- A Cloudflare account and Wrangler CLI access.
- A Resend account, verified sending domain, and API key.
- GitHub CLI for publishing and creating the prepared backlog.

During implementation, keep secrets in local environment files excluded by Git and in Cloudflare secrets for deployed environments. Never commit tokens or production personal data.

## Local development

```sh
pnpm install
cp .dev.vars.example .dev.vars
pnpm db:migrate:local
pnpm dev
```

Run `pnpm check` before committing. It type-checks, tests, validates Drizzle migrations, and builds the Worker plus React client. The current vertical slice exposes `/api/health`, invitation acceptance, login/logout, session lookup, password-reset endpoints, and an administrator invitation endpoint. The first production administrator is created with the operator command documented in `docs/SETUP.md`.

The production build temporarily excludes `.dev.vars` and scans `dist` for secret files/markers before succeeding. `pnpm preview` follows Cloudflare's local-preview behavior and may copy `.dev.vars` into ignored build output; Cloudflare documents that this preview copy is not deployed.

The verified production D1 ID is configured in `wrangler.jsonc`. The application origin is `https://ino.praiasertao.com.br`; production secrets are `AUTH_PEPPER` and `RESEND_API_KEY`.

## Deployment prerequisites

Before production deployment, an owner must:

1. Create/select Cloudflare accounts, Worker/D1 resources, environments, and custom domains.
2. Configure the production application origin, session/signing secrets, password pepper, rate limiting, and Turnstile if the auth spike adopts it.
3. Verify a Resend sending domain and choose sender/reply-to addresses for invitations, password resets, reminders, and reports.
4. Confirm invite lifetime, session lifetime, password-reset policy, cycle anchor date, initial team membership, anonymity threshold, retention periods, privacy notice, and named privacy administrators.
5. Configure GitHub environments/secrets, production observability, backups/export policy, and incident ownership.

## Account creation and authentication

There is no public signup. An admin creates a user and sends an invitation email. The invitation URL contains a cryptographically random, single-use opaque token—not the email address. The server stores only the token digest and binds it to the invited user/email. After following the link, the page displays the bound email as read-only and asks the user to create a password.

Passwords are never stored or encrypted reversibly. Prefer Argon2id with OWASP-recommended parameters if a Worker compatibility/performance spike succeeds; otherwise use versioned PBKDF2-HMAC-SHA-256 through Workers Web Crypto with a unique random salt, a production-tuned work factor, and an optional pepper kept in a Worker secret. Sessions use random opaque tokens stored only as digests server-side and sent in `Secure`, `HttpOnly`, `SameSite=Lax` cookies. Invitations and reset tokens expire, are single-use, and are invalidated transactionally.

The invite/reset pages use HTTPS, a fixed allowlisted application origin, `Referrer-Policy: no-referrer`, generic error responses, and rate limiting. Without MFA, the initial policy is at least 15 characters and supports up to at least 128, with Unicode/whitespace and password-manager paste supported, no composition rules, no silent truncation, and no forced periodic changes. Screen common/breached passwords without disclosing plaintext. TOTP MFA is required for administrators before the production pilot; its implementation remains a release blocker.

## Planning documents

- [Roadmap and acceptance criteria](ROADMAP.md)
- [Proposed relational data model](docs/DATA_MODEL.md)
- [Privacy and anonymity rules](docs/PRIVACY.md)
- [Architecture decisions and open questions](docs/DECISIONS.md)
- [Prepared GitHub backlog](docs/GITHUB_ISSUES.md)
- [Accepted setup choices and operator actions](docs/SETUP.md)

## Publishing to GitHub

The local repository is ready to publish, but GitHub authentication must be valid:

```sh
gh auth login -h github.com
./scripts/create-github-issues.sh
```

Run these commands from the repository root. The repository already exists as `feedback`; the script is idempotent by exact issue title and creates labels plus the planned issues.
