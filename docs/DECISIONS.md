# Architecture decision log

Concise ADR-style records for agreed direction. Statuses are `accepted`, `proposed`, or `open`.

## ADR-001 — Cloudflare-first deployment

- **Status:** accepted
- **Decision:** Use Cloudflare Workers with Static Assets for the React application and API, and Cloudflare D1 for relational data.
- **Why:** One small deployment surface, suitable free tiers, and a relational model that fits users, teams, cycles, submissions, and meetings.
- **Consequences:** Design for Worker/D1 runtime constraints; use local/preview environments; verify current Cloudflare quotas before production.

## ADR-002 — React, TypeScript, and Vite

- **Status:** accepted
- **Decision:** Use React + TypeScript + Vite for the UI.
- **Why:** Small, familiar, strongly typed web stack compatible with Worker Static Assets.
- **Consequences:** Keep routing/state dependencies modest and choose exact libraries in the foundation issue.

## ADR-003 — Drizzle for D1 access

- **Status:** proposed
- **Decision:** Prefer Drizzle ORM and checked-in SQL migrations.
- **Why:** Typed relational access and reviewable migrations without hiding SQL/privacy-sensitive query behavior.
- **Consequences:** Prototype D1 migration/local workflow before final acceptance; privacy aggregate queries may use explicit SQL.

## ADR-004 — Microsoft Entra through Cloudflare Access

- **Status:** proposed pending spike
- **Decision:** Put the internal app behind Cloudflare Access using Microsoft Entra ID, then map the verified identity to an active application user.
- **Why:** Centralizes internal access and avoids a separate browser OAuth/session implementation for MVP.
- **Consequences:** Requires Entra/Zero Trust administrative permission. The Worker must verify Access identity and apply its own RBAC. Firebase is the fallback only if the spike shows Access cannot meet requirements.

## ADR-005 — Multi-role RBAC

- **Status:** accepted
- **Decision:** Model roles through a many-to-many `user_roles` table; a user may be admin, coordinator, and/or employee.
- **Why:** Real team members can have overlapping responsibilities.
- **Consequences:** Every API capability is permission/scoped-resource checked; UI role switching is not authorization.

## ADR-006 — Database-backed 14-day schedule

- **Status:** accepted
- **Decision:** Store an anchor date, `America/Fortaleza`, and a 14-day interval. Run cron frequently in UTC and let idempotent application logic claim due transitions.
- **Why:** A cron expression alone cannot faithfully encode every-other-Friday, and local-time intent should remain explicit.
- **Consequences:** Persist all instants in UTC, test timezone boundaries, and protect transitions/jobs with unique idempotency keys.

## ADR-007 — Confidential attribution with anonymous presentation

- **Status:** accepted
- **Decision:** Retain confidential participant-to-submission attribution only as needed for eligibility, deduplication, reminders, integrity, and approved investigations. Never expose it to coordinators or ordinary admins.
- **Why:** The product needs exactly-once submission and participation status while promising respondent anonymity in ordinary use.
- **Consequences:** Product copy must not promise irreversible anonymity. Separate reporting projections, enforce thresholds, minimize retention, and strictly audit exceptional access.

## ADR-008 — Minimum cohort threshold

- **Status:** proposed
- **Decision:** Default coordinator reporting threshold is three eligible submitted responses, snapshotted per cycle, with stronger qualitative/differencing protections.
- **Why:** Reduce straightforward identification risk in small groups.
- **Consequences:** Some teams/cycles receive no report. Privacy owner must approve whether `3` is sufficient and define small-team behavior.

## ADR-009 — Employee history is status-only

- **Status:** accepted
- **Decision:** Show one visual item per eligible past cycle with exactly `done` or `skipped`; do not show the employee their survey answers, comments, or scores, and do not pre-render future cycles.
- **Why:** Meet the desired lightweight participation-history experience without creating a personal score archive.
- **Consequences:** Derive the view from eligibility and submission existence; accessible labels must not rely on color alone.

## ADR-010 — Resend email for MVP

- **Status:** accepted
- **Decision:** Use Resend behind a small provider interface and durable D1-backed job state.
- **Why:** Simple transactional delivery for reminders/report-ready notifications.
- **Consequences:** Requires a verified domain and secrets. Emails remain generic, idempotent, and contain no survey content.

## ADR-011 — Meeting ratings are development pulses, not NPS

- **Status:** accepted
- **Decision:** Use structured internal development dimensions/ratings plus notes, recognition, growth opportunities, and action items.
- **Why:** NPS has a specific promoter/detractor methodology and is misleading for employee development ratings.
- **Consequences:** Define dimensions, scale, visibility, and interpretation with People/HR before implementation.

## ADR-012 — No AI insight generation in MVP

- **Status:** accepted
- **Decision:** Start with deterministic aggregates, trends, topic selections, and coordinator-authored meeting context.
- **Why:** AI summarization adds privacy, accuracy, consent, and operational risk before the core process is validated.
- **Consequences:** Revisit later with a separate privacy/security evaluation and human review.

## ADR-013 — Recognition share card is V2 and opt-in

- **Status:** accepted
- **Decision:** Defer generated congratulation art and LinkedIn-oriented sharing to V2; generation and external sharing require explicit employee actions.
- **Why:** It is valuable but not necessary to validate the feedback loop, and it may expose private employment information.
- **Consequences:** Keep recognition structured enough to support a future card, but build no external posting in MVP.

## Open questions before implementation/launch

| Owner | Question | Needed by |
|---|---|---|
| Product/People | What Friday is the first anchor, and do holidays postpone or skip a cycle? | Scheduler implementation |
| Privacy/People | Is threshold `3` sufficient? What happens to teams below it or cycles with organizational changes? | Reporting design |
| Privacy/Legal | What are the retention/deletion periods for attribution, answers, free text, meeting data, audit, and backups? | Schema production launch |
| IT | Which Entra tenant/claim is stable, who can register the app, and what MFA/Conditional Access policy applies? | Auth spike |
| Product | Can one employee belong to multiple teams and can a team have multiple coordinators simultaneously? | Admin/schema implementation |
| Product/Privacy | Is feedback submission immutable, editable until close, or withdrawable? | Survey API |
| Product/Privacy | Are free-text comments shown verbatim, moderated, withheld when identifying, or converted to reviewed themes? | Coordinator reporting |
| People | Which development pulse dimensions/scale are used, and which notes may be coordinator-only? | Meeting implementation |
| Operations | Who holds exceptional privacy access and who reviews its audit events? | Production launch |
| Product | Are reminders sent at cycle open only or repeated for incomplete participants? | Email implementation |
| Product | Does “report Monday 09:00” mean notification that a dashboard is ready, or an emailed summary? Recommended: generic notification/link only. | Email implementation |
| Engineering | Exact Node/package-manager versions, testing libraries, UI kit, router, validation library, and CI provider. | Foundation issue |
