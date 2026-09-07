# Implementation Plans

Marine-operations planning based on the existing Nuxt template and a read-only schema inspection of the `shipping_db` database. Execute in order; do not connect the browser directly to PostgreSQL.

## Execution order & status

| Plan | Title | Priority | Effort | Depends on | Status |
|------|-------|----------|--------|------------|--------|
| 001 | Establish marine data foundation and replace mock domain | P1 | L | — | TODO |
| 002 | Replace Sentinel Copilot simulations with a bounded OpenRouter/LangChain agent | P1 | M | 001 | DONE |

Status values: TODO | IN PROGRESS | DONE | BLOCKED | REJECTED

## Dependency notes

- Plan 001 must establish the canonical table/read-model contract before any page is switched from mocks to live data. The database contains legacy, standard, partitioned, and empty duplicate tables; choosing sources ad hoc in page components would create inconsistent behavior.

## Findings considered and rejected

- Direct browser-to-PostgreSQL access: rejected because it exposes database access at the browser boundary. Use Nuxt server routes and server-only environment secrets.
- Reusing the current shipment/order domain for vessels: rejected because the database has a clear vessel root (`ship`) and marine telemetry/reporting model; forcing vessels into orders, customers, or inventory would create misleading product semantics.
- Per-alert LLM calls during page render: rejected because they add cost, latency, and nondeterministic rows; use the operator-invoked Sentinel workbench with bounded read-only tools.
- Autonomous write tools in the first agent slice: rejected because acknowledgement, dispatch, notification, and vessel-control actions require sessions, authorization, CSRF, audit logging, and least-privilege write access first.
