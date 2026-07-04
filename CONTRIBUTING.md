# Contributing

Thanks for contributing. This doc covers what you need to get set up and how to get a change merged.

## Getting Started

This repo is a **pnpm monorepo** — npm/yarn installs are blocked by a preinstall check. Make sure you have pnpm installed (`npm install -g pnpm` if you don't).

```bash
git clone https://github.com/creova-gif/Audit-OS.git
cd Audit-OS
pnpm install
pnpm run build
```

## Before You Open a Pull Request

1. **Branch from `main`** — use a descriptive branch name, e.g. `fix/api-timeout` or `feat/add-webhook`.
2. **Keep PRs focused** — one logical change per PR.
3. **Never commit secrets** — no `.env` files, API keys, or tokens, especially given this repo touches real third-party integrations. Check `.gitignore` before adding any new config file.
4. **Run `pnpm run typecheck` before pushing** — this monorepo enforces TypeScript project references; broken types in one package can silently break others.
5. **Write a clear PR description** — what changed, why, and how you tested it.

## Code Review

- All PRs require review before merging to `main` — direct pushes to `main` are blocked.
- Address review feedback with new commits rather than force-pushing.

## Repository Structure

Code lives under `artifacts/` — check the existing structure (`api-server/src/routes/`, etc.) before adding new files, and follow the existing pattern for routes/middleware.

## Reporting Bugs / Requesting Features

Open a GitHub issue with what you expected, what happened, and reproduction steps.

## Security

Found a security issue? See [`SECURITY.md`](./SECURITY.md) — don't open a public issue for vulnerabilities. This is especially important for this repo given the real third-party API integrations involved.

## Questions

Open an issue or reach out to the maintainer directly if you're unsure where to start.
