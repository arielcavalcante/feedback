# Prepared GitHub backlog

The repository includes one body file per issue in `.github/issues/` and an idempotent creation script. After authenticating and publishing the repository, run:

```sh
./scripts/create-github-issues.sh
```

The script creates these issues in dependency-friendly order:

1. Scaffold the Cloudflare React application and CI
2. Prove Microsoft Entra ID authentication through Cloudflare Access
3. Design D1 schema and Drizzle migrations
4. Implement application identity and multi-role authorization
5. Build audit logging and safe observability foundation
6. Build admin user and role management
7. Build admin team, membership, and coordinator management
8. Implement the biweekly cycle scheduler
9. Implement employee eligibility and feedback submission
10. Build the employee done/skipped history grid
11. Implement privacy-safe aggregate reporting
12. Add qualitative topics and protected comment display
13. Implement durable Resend email jobs
14. Build the coordinator dashboard and trends
15. Build meeting preparation and outcomes
16. Build the employee meeting outcomes view
17. Complete accessibility, responsive, and end-to-end QA
18. Deploy production with observability and run a privacy-reviewed pilot
19. V1.1: Add an employee pre-1:1 agenda
20. V2: Generate an opt-in recognition share card

Every body contains scope and acceptance criteria. Issue URLs cannot be known until GitHub authentication succeeds and the repository is created.
