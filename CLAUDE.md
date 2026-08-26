# CLAUDE.md — audit-os

## Project Overview
Compliance/audit monorepo (pnpm workspace).

## Technology Stack
pnpm workspace monorepo. Use `pnpm install --frozen-lockfile` and `pnpm build` — never `npm`/`yarn` commands, which will not respect the workspace structure.

## CI
`pnpm install --frozen-lockfile && pnpm build`.

## AI Agent Rules
- Before adding a dependency, check which workspace package actually needs it — add it to that package's `package.json`, not the root, unless it's a genuine dev-tooling dependency shared by all packages.
- This repo has not had a full security/architecture audit in this engagement — do not assume its backend/auth patterns match other repos in this portfolio without checking directly.

## Definition of Done
`pnpm build` passes across the whole workspace, not just the package you touched.
