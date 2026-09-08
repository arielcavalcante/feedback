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
  "Prove Microsoft Entra ID authentication through Cloudflare Access"
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

for index in "${!titles[@]}"; do
  number="$(printf '%02d' "$((index + 1))")"
  title="${titles[$index]}"
  body_file=".github/issues/${number}.md"
  if grep -Fqx "$title" <<<"$existing_titles"; then
    echo "Exists: $title"
  else
    gh issue create --title "$title" --label "${labels[$index]}" --body-file "$body_file"
  fi
done
