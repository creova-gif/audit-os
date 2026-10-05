# Audit OS

**Practice management for audit and accounting firms — engagements, working papers, findings, and client data rooms in one system.**

[![Status](https://img.shields.io/badge/status-active_development-yellow)]()
[![License](https://img.shields.io/badge/license-proprietary-red)]()

## Overview
Workflow tooling for audit and accounting firms, comparable in scope to CaseWare/AuditBoard.

## Problem
Smaller audit/accounting firms are priced out of enterprise engagement-management platforms and fall back to spreadsheets and email for working papers and client document exchange.

## Solution
Engagement tracking from kickoff to sign-off, working papers, findings tracking, anomaly detection, and a secure client data room, structured around how an audit engagement actually runs.

## Key Capabilities
- Engagements, clients, staff assignment and workload
- Working papers and findings tracking
- Anomaly detection on client data
- Secure client data room

## Architecture
Node.js, pnpm monorepo. `artifacts/api-server` is the real backend.

## Technology Stack

| Layer | Technology |
|---|---|
| Monorepo | pnpm workspaces |
| Backend | Node.js (`artifacts/api-server`) |

## Getting Started
```bash
git clone https://github.com/creova-gif/audit-os.git
cd audit-os
pnpm install
pnpm run build
```
Run locally: `pnpm --filter @workspace/audit-os run dev` and `pnpm --filter @workspace/api-server run dev`.

## Project Status
Core routes implemented (engagements, clients, findings, working papers, anomalies, staff, data room). No dedicated `.env.example` or onboarding docs yet.

## Roadmap
- [ ] Add `.env.example` and local dev-server onboarding instructions

## Contributing
Private, proprietary CREOVA product.

## License
Proprietary — All Rights Reserved. See `LICENSE`.

## Author / Organization
Built by [Justin Mafie](https://github.com/creova-gif) under CREOVA.
