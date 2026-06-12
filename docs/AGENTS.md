# docs/

Documentation rules.

- `docs/index.md` is the navigation map; keep it aligned when adding major docs or changing source-of-truth locations.
- Feature specs live in `docs/features/`; follow `docs/features/AGENTS.md`.
- Ask before broad documentation rewrites or restructures when the user did not explicitly request doc edits; keep required doc touchups narrow.
- When doc edits are requested, run the same default gate as code changes: `bun run verify:commit`.
- Do not leave migration plans, improvement reports, or status summaries in the repo.
- Use GitHub issues/PRs for durable tracking.
