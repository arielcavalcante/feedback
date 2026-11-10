# Codex project guardrails

- Read `README.md`, `ROADMAP.md`, `docs/DECISIONS.md`, `docs/DATA_MODEL.md`, and `docs/PRIVACY.md` before implementation.
- Preserve privacy invariants. The Worker/API is the authorization boundary; UI hiding is never sufficient.
- There is no public signup or Microsoft login. Admins issue opaque, single-use invitations bound server-side to a locked email.
- Never store or log plaintext passwords or raw invitation, reset, or session tokens. Use versioned slow password hashes and digest-only high-entropy tokens.
- Coordinators and ordinary admins never receive respondent identity, exact submission times, or sub-threshold results — except for check-ins and complaints the employee explicitly signed (ADR-026, ADR-027), which never count toward anonymous results.
- Employee cycle history returns only past-cycle label/date and `done` or `skipped`. An employee sees their own scores and comment only for check-ins they signed (ADR-027); anonymous answers are never shown back, not even to their author.
- Enforce multi-role authorization and team/resource scope in every protected API handler.
- Use UTC persisted timestamps and explicit `America/Fortaleza` schedule computation from a stored weekly anchor (ADR-026).
- Make authentication tokens, scheduler transitions, and email jobs expiry-aware, idempotent, and retry-safe.
- Keep secrets and production data out of source control, logs, fixtures, screenshots, and analytics.
- Do not call development ratings “NPS” or implement AI analysis or external sharing in MVP.
- If a request weakens anonymity or authentication security, or expands data collection, update the applicable ADR before implementation.
- `docs/SEGURANCA.md` is the security and privacy architecture document for InfoSec. Whenever documentation is updated, review it against the code, update the affected sections and its commit/date header, and keep its Mermaid diagrams valid.
