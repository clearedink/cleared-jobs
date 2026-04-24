# Cleared Jobs SDK

**Cleared** is a durable, funded-admission and recovery layer for paid asynchronous jobs. It bridges the gap between decentralized payments and long-running computational workloads, ensuring that every paid request is recorded, admitted exactly once, and results in a verifiable, retrievable outcome.

---

## Why Payment is Not Enough

In many asynchronous systems, payments are treated as simple "events." However, for expensive or mission-critical jobs (like AI batch enrichment or cross-domain data processing), simply receiving a payment signal is insufficient:

1.  **Imperfect Idempotency**: Clients may retry payments or submissions. Without a funded-admission layer, you risk double-charging or double-processing.
2.  **The "Lost Response" Problem**: If a client disconnects after paying but before the job finishes, the result is often lost. Cleared ensures the result is canonical and retrievable by the job's ID.
3.  **Unreliable Fulfillment**: Workers can fail or timeout. Cleared enforces a resolution state (Success, Refund, or Manual Review) that is decoupled from the execution state.
4.  **Auditability**: Every financial state change (escrow hold, release, refund) must be auditable and linked to a specific job identity.

---

## Architecture

The Cleared SDK is built as a TypeScript monorepo with a clean hexagonal architecture:

-   [`packages/core`](file:///Users/mas/Documents/cleared-jobs/packages/core): The heart of the system. Contains the domain models, status enums, and the `admitFundedJob` orchestration logic.
-   [`packages/payment-x402`](file:///Users/mas/Documents/cleared-jobs/packages/payment-x402): A demo-ready adapter for X402-style payment challenges and proof verification.
-   [`packages/http-402-express`](file:///Users/mas/Documents/cleared-jobs/packages/http-402-express): Thin glue layer providing 402 (Payment Required) and 202 (Accepted) response helpers for Express.
-   [`packages/storage-memory`](file:///Users/mas/Documents/cleared-jobs/packages/storage-memory): A high-fidelity in-memory storage implementation for local development and testing.
-   [`packages/worker-adapter`](file:///Users/mas/Documents/cleared-jobs/packages/worker-adapter): Helpers for workers to report start, success, and failure back to the core.
-   [`examples/basic-seller-api`](file:///Users/mas/Documents/cleared-jobs/examples/basic-seller-api): A complete, runnable reference implementation.

---

## The Happy Path

1.  **Request**: Client calls `POST /v1/jobs/run`.
2.  **Quote**: Core generates a `Quote` and a deterministic input hash.
3.  **402 Response**: Service returns a `402 Payment Required` with an X402 challenge and a `paymentIdentifier`.
4.  **Funded Retry**: Client pays and retries the same endpoint with a `payment_proof`.
5.  **Exactly Once Admission**: Core verifies the proof, locks the `paymentIdentifier`, and admits exactly one `JobId`.
6.  **Worker Run**: The worker picks up the job and reports progress via the callback client.
7.  **Result Retrieval**: Client polls `GET /v1/jobs/:jobId/result` to retrieve the final output.

---

## Hard Invariants

Cleared enforces these rules strictly at the core level:
-   **Invariant 1**: One `paymentIdentifier` admits at most one `Job`.
-   **Invariant 2**: One `JobId` is the persistent, canonical identity for all post-payment actions.
-   **Invariant 3**: Retries produce new `Attempts`, but never a new funded `Job`.
-   **Invariant 4**: Results are immutable once stored and remain retrievable even if the original caller has disappeared.
-   **Invariant 5**: Financial resolution (Escrow) is queryable and manageable independently from worker status.
-   **Invariant 6**: Every terminal or operator-driven action produces a permanent audit log.

---

## Demo Scripts

We include several scripts to exercise the system's durability:
-   `npm run demo:happy`: Standard end-to-end success.
-   `npm run demo:retry`: Proves that duplicate submissions return the same `jobId`.
-   `npm run demo:lost`: Simulates caller disconnection and later result retrieval.
-   `npm run demo:timeout`: Shows how overdue jobs move to automated refund/manual review.

---

## Known Limitations

-   **Demo Mode Only**: The provided storage and payment adapters are for local development and lack production-grade security signatures.
-   **Single Process Control**: The admission lock in `storage-memory` is suited for single-node environments.
-   **No Scheduler**: Workers are triggered via a simple callback; a production setup would use a persistent job queue (e.g., BullMQ).

---

## Out of Scope

Cleared is **not**:
-   A general-purpose X402 payment platform.
-   A wallet provisioning service or treasury management system.
-   A browser automation or data scraping fleet.
-   A customer-facing dashboard for job management.

---

## License
MIT
