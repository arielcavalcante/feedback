# Setup decisions and operator actions

## 1. What “verify a Resend domain” means

Resend must be allowed to send mail using `praiasertao.com.br`. In Resend, add the sending domain (prefer a dedicated subdomain such as `mail.praiasertao.com.br`), then add the DNS records Resend displays to Cloudflare DNS. These normally establish DKIM/SPF and return-path ownership. Wait for Resend to show the domain as verified, then choose a sender such as `Feedback <feedback@mail.praiasertao.com.br>`.

The application needs two Worker secrets/variables: `RESEND_API_KEY` and `EMAIL_FROM`. Invitations and password resets contain account links; feedback reminders and coordinator notices remain generic and contain no answers.

## 2. Production URL

Accepted: `https://feedback.praiasertao.com.br`. It is configured as the application origin and proposed Worker custom domain in `wrangler.jsonc`. Invitation/reset links must always use this fixed origin, never a request `Host` header.

## 3. Bootstrap administrator choices

### A — One-time operator command (selected)

After remote migrations, run `pnpm admin:bootstrap -- you@example.com "Your Name" --remote`. It inserts the first admin and prints one opaque invitation URL once. Open it privately to set the password. Anyone able to run this command already has D1 write authority; no bootstrap HTTP endpoint remains exposed.

### B — Deployment seed variables

Create the first admin from temporary deployment secrets and delete those secrets immediately. This automates deployment but leaves more bootstrap logic and secret lifecycle to secure.

### C — Temporary bootstrap endpoint

Protect a one-time endpoint with a secret and disable it after use. This is the least-preferred option because it briefly creates a remote account-creation surface.

## 4. Accepted authentication defaults

- Invitation lifetime: 48 hours.
- Password-reset lifetime: 30 minutes.
- Session idle lifetime: 7 days.
- Session absolute lifetime: 30 days.
- Minimum password: 15 characters because MVP has no MFA; maximum supported length: 128.
- No composition rules, silent truncation, or routine forced rotation.
- TOTP MFA through an authenticator app is required for administrators before the production pilot. Recovery codes are single-use and stored only as slow/digest hashes; TOTP secrets must be encrypted with a separately managed Worker secret.

## 5. Cloudflare resources

The Worker and D1 database already exist. Replace the placeholder D1 ID in `wrangler.jsonc`, authenticate Wrangler, apply migrations remotely, set secrets, then deploy. Do not run remote migrations until the D1 target has been verified by name and ID.

## 6. Feedback schedule and holidays

Accepted anchor: Friday, September 18, 2026 at 09:00 `America/Fortaleza`, repeating every 14 days. Survey open/close dates do not move for holidays.

- If opening Friday is a Fortaleza work holiday, the employee email moves to the previous workday at 09:00.
- If report Monday is a Fortaleza work holiday, the coordinator email moves to the next workday at 09:00.
- A workday is Monday–Friday and absent from the `holidays` table.
- National, Ceará, Fortaleza, and company holidays live in the table so exceptional dates can be added without redeployment.
- The calendar must be reviewed and loaded before every new year. The initial migration includes relevant remaining 2026 national holidays; it is not a perpetual holiday service.

## 7. Organization structure

The schema supports users with multiple roles and memberships in multiple teams. A team may hold multiple coordinator assignments and marks one as primary for cycle snapshotting. MVP administration may enforce one active team membership and one primary coordinator, but the relational structure does not require a future migration to expand this.

## 8. Accepted privacy and retention defaults

- Anonymity threshold: three submitted responses for the exact authorized cohort.
- Small teams/cycles below threshold receive no results or comments; they are not silently pooled.
- Qualitative comments may be shown verbatim only above threshold, without time/order cues, and may be withheld when self-identifying or harmful.
- Survey attribution, numeric answers, and qualitative text: 24 months.
- Meeting outcomes and action items: 36 months after the meeting.
- Completed/failed email delivery records: 90 days; never retain rendered message bodies.
- Expired/used invitation and reset metadata plus ended sessions: 30 days.
- Rate-limit buckets: delete after 30 days of inactivity.
- Audit logs and organization assignment history: 24 months after the related user's deactivation, unless a legal requirement sets a longer period.

These are application defaults, not substitutes for a final employment/privacy-law review.
