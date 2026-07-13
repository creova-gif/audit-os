# Audit OS

**Practice management for audit and accounting firms — engagements, working papers, findings, and client data rooms in one system.**

[![Status](https://img.shields.io/badge/status-active_development-yellow)]()
[![License](https://img.shields.io/badge/license-proprietary-red)]()

---

## What this is

Audit OS gives audit and accounting firms the workflow tooling that larger platforms (CaseWare, AuditBoard) offer, structured around how an engagement actually runs: client intake, staff assignment, working papers, findings, and anomaly detection, with a secure data room for client document exchange.

---

## Core Features

- **Engagements** — track each audit engagement from kickoff to sign-off
- **Clients** — client records and relationship management
- **Data room** — secure document exchange with clients
- **Working papers** — the actual audit workpaper trail
- **Findings** — tracked audit findings and their resolution status
- **Anomaly detection** — automated flagging of unusual patterns in client data
- **Staff** — team assignment and workload across engagements

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Node.js, pnpm monorepo |
| Architecture | API server (`artifacts/api-server`) |

---

## Getting Started (Local Dev)

### Prerequisites
- Node.js 18+
- **pnpm** (enforced via preinstall check — npm/yarn installs are blocked)

### Installation

```bash
git clone https://github.com/creova-gif/audit-os.git
cd audit-os
pnpm install
pnpm run build
```

Run the app locally with `pnpm --filter @workspace/audit-os run dev` and the API server with `pnpm --filter @workspace/api-server run dev`.

---

## Roadmap / Status

Core routes are implemented (engagements, clients, findings, working papers, anomalies, staff, data room). A `.env.example` and local dev-server run instructions should be added for onboarding.

## Contributing

This is a private, proprietary CREOVA product. External contributions are not accepted at this time.

## License

Proprietary — All Rights Reserved. See `LICENSE`.

## Credits

Built by CREOVA. Product lead: Justin Mafie.
