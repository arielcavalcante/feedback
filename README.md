# Team Feedback

Planning repository for a small internal feedback platform. The product runs a private, recurring feedback process while keeping survey respondents anonymous to coordinators and colleagues.

This initial commit contains product and engineering plans only. It intentionally does not include an application implementation.

## Product overview

Every 14 days, employees receive a short survey about their coordinator, team, and work. A cycle opens Friday at 09:00 and closes Sunday at 23:59 in `America/Fortaleza`; eligible coordinator reports are sent Monday at 09:00. Coordinators use anonymous, aggregated signals in team dashboards and in meeting preparation. Employees can review meeting outcomes and a simple history of whether they completed or skipped each past cycle, but never their survey answers or scores.

## Architecture

- React, TypeScript, and Vite for the web interface.
- Cloudflare Workers with Static Assets for the web app and API.
- Cloudflare D1 for relational storage, preferably accessed through Drizzle ORM.
- Microsoft Entra ID through Cloudflare Access for internal authentication, subject to a short proof of concept.
- Resend for MVP transactional email.
- Cloudflare Cron Triggers as frequent UTC wake-ups. Application/database logic determines whether a Fortaleza-local event is due; cron expressions do not encode the 14-day recurrence.

The Worker is the authorization and privacy boundary. Browser code must never receive hidden survey attribution or raw answers that it does not need.

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

- Entra/Cloudflare Access authentication and application RBAC.
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
- A Cloudflare Zero Trust organization with permission to configure Access.
- A Microsoft Entra tenant and permission to create/configure an enterprise application.
- A Resend account, verified sending domain, and API key.
- GitHub CLI for publishing and creating the prepared backlog.

During implementation, keep secrets in local environment files excluded by Git and in Cloudflare secrets for deployed environments. Never commit tokens or production personal data.

## Deployment prerequisites

Before production deployment, an owner must:

1. Create/select Cloudflare accounts, Worker/D1 resources, environments, and custom domains.
2. Configure the Entra enterprise application and Cloudflare Access identity provider/policy; decide allowed tenant/domain and break-glass access.
3. Verify a Resend sending domain and choose sender/reply-to addresses.
4. Confirm the cycle anchor date, initial team membership, anonymity threshold, retention periods, privacy notice, and named privacy administrators.
5. Configure GitHub environments/secrets, production observability, backups/export policy, and incident ownership.

## Planning documents

- [Roadmap and acceptance criteria](ROADMAP.md)
- [Proposed relational data model](docs/DATA_MODEL.md)
- [Privacy and anonymity rules](docs/PRIVACY.md)
- [Architecture decisions and open questions](docs/DECISIONS.md)
- [Prepared GitHub backlog](docs/GITHUB_ISSUES.md)

## Publishing to GitHub

The local repository is ready to publish, but GitHub authentication must be valid:

```sh
gh auth login -h github.com
gh repo create team-feedback --private --source=. --remote=origin --push
./scripts/create-github-issues.sh
```

Run these commands from the repository root. The script is idempotent by exact issue title and creates labels plus the planned issues.
# feedback
