# Implementation Plans

Marine-operations planning based on the existing Nuxt template and a read-only schema inspection of the `shipping_db` database. Execute in order; do not connect the browser directly to PostgreSQL.

## Execution order & status

| Plan | Title | Priority | Effort | Depends on | Status |
|------|-------|----------|--------|------------|--------|
| 001 | Establish marine data foundation and replace mock domain | P1 | L | — | TODO |

Status values: TODO | IN PROGRESS | DONE | BLOCKED | REJECTED

## Dependency notes

- Plan 001 must establish the canonical table/read-model contract before any page is switched from mocks to live data. The database contains legacy, standard, partitioned, and empty duplicate tables; choosing sources ad hoc in page components would create inconsistent behavior.

## Findings considered and rejected

- Direct browser-to-PostgreSQL access: rejected because it exposes database access at the browser boundary. Use Nuxt server routes and server-only environment secrets.
- Reusing the current shipment/order domain for vessels: rejected because the database has a clear vessel root (`ship`) and marine telemetry/reporting model; forcing vessels into orders, customers, or inventory would create misleading product semantics.
