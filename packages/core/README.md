# Cleared API Reference

This document describes the public API for Cleared Jobs.

Cleared is designed for paid asynchronous work. It does not replace x402 payment libraries. Instead, it sits around the paid job lifecycle:

```txt
job intent → x402 payment → paid admission → job execution → result recovery
```

The main API is `handlePaidJobRequest()`. Lower-level APIs are available when applications want more control.

---

## Installation

```bash
npm install @cleared/core
```

Optional adapters:

```bash
npm install @cleared/storage-memory
npm install @cleared/x402
```

---

## Creating a Cleared Client

```ts
import { createCleared } from "@cleared/core";
import { createMemoryStorage } from "@cleared/storage-memory";

export const cleared = createCleared({
  storage: createMemoryStorage(),
});
```

In production, use a durable storage adapter instead of memory storage (Production storage adapter planned).

---

# Core Functions

## `handlePaidJobRequest()`

High-level convenience API for paid async routes.

It handles both sides of the paid-job lifecycle:

1. **Before payment**: creates or reuses a stable job intent for the requested job.
2. **After payment**: attaches the verified x402 payment to that intent and admits exactly one durable job.

Use this in the HTTP route that receives a paid job request.

```ts
export async function handlePaidJobRequest(
  input: HandlePaidJobRequestInput,
): Promise<HandlePaidJobRequestResult>;
```

### Example

```ts
const result = await cleared.handlePaidJobRequest({
  idempotencyKey: req.header("Idempotency-Key"),

  buyerKey: req.body.agentId,
  jobType: "quest_submission",
  inputHash,

  price: {
    amount: "0.05",
    currency: "USDC",
    network: "solana-devnet",
  },

  payload: {
    questId,
    agentId,
    submissionUrl,
  },

  payment: req.x402?.payment,

  enqueue: async ({ jobId }) => {
    await queue.add("quest_submission", { jobId });
  },
});

if (result.type === "payment_required") {
  return res.status(402).json(result.paymentRequirement);
}

return res.status(202).json({
  jobId: result.jobId,
  status: result.status,
  resultUrl: `/jobs/${result.jobId}/result`,
});
```

### Input

```ts
export type HandlePaidJobRequestInput = {
  /**
   * Stable client-provided idempotency key.
   *
   * This is used before payment to prevent the same buyer from creating
   * multiple job intents for the same intended job.
   *
   * Recommended source:
   *   req.header("Idempotency-Key")
   */
  idempotencyKey: string;

  /**
   * Stable buyer identity inside the seller application.
   *
   * Examples:
   * - user id
   * - agent id
   * - API client id
   * - wallet address
   */
  buyerKey: string;

  /**
   * Application-defined job type.
   *
   * Examples:
   * - "quest_submission"
   * - "account_research"
   * - "video_batch_render"
   * - "data_enrichment"
   */
  jobType: string;

  /**
   * Deterministic hash of the requested work.
   *
   * Used to detect whether the same idempotency key is being reused
   * for the same input or accidentally reused for different work.
   */
  inputHash: string;

  /**
   * Price and network used to generate the x402 payment requirement.
   */
  price: JobPrice;

  /**
   * Application payload stored with the job.
   *
   * Workers can later load this payload using `getJob()`.
   */
  payload: Record<string, unknown>;

  /**
   * Optional verified x402 payment.
   *
   * If missing, Cleared returns `payment_required`.
   * If present and valid, Cleared admits or returns the durable job.
   */
  payment?: VerifiedX402Payment;

  /**
   * Optional queue handoff.
   *
   * Called only after Cleared has durably admitted the paid job.
   *
   * If enqueue fails, the job record still exists and can be recovered.
   * Production storage adapters should use an outbox pattern to make this
   * handoff retryable.
   */
  enqueue?: (args: EnqueueArgs) => Promise<void>;

  /**
   * Optional metadata stored on the job intent and job.
   */
  metadata?: Record<string, unknown>;
};
```

### Result

```ts
export type HandlePaidJobRequestResult =
  | JobIntentRequiredResult
  | PaidJobAcceptedResult;
```

```ts
export type JobIntentRequiredResult = {
  /**
   * No valid payment was attached yet.
   *
   * Return this as HTTP 402.
   */
  type: "payment_required";

  /**
   * Stable pre-job intent id.
   */
  intentId: string;

  /**
   * x402-compatible payment requirement for this intent.
   *
   * Shape depends on the active x402 adapter.
   */
  paymentRequirement: unknown;

  /**
   * Current intent status.
   */
  status: JobIntentStatus;
};
```

```ts
export type PaidJobAcceptedResult = {
  /**
   * Payment was verified and a job was admitted,
   * or the same paid request was already admitted earlier.
   */
  type: "admitted" | "already_admitted";

  /**
   * Stable job intent connected to this job.
   */
  intentId: string;

  /**
   * Canonical durable job id.
   */
  jobId: string;

  /**
   * Current job status.
   */
  status: JobStatus;

  /**
   * Verified payment id connected to the job.
   */
  paymentId: string;

  /**
   * Result of the enqueue callback.
   */
  enqueueStatus?: "not_requested" | "queued" | "failed";
};
```

---

## `getOrCreateJobIntent()`

Lower-level API for creating or reusing a stable pre-job intent.

Use this when your app wants to generate the x402 payment requirement separately from job admission.

```ts
export async function getOrCreateJobIntent(
  input: GetOrCreateJobIntentInput,
): Promise<JobIntentRecord>;
```

### Example

```ts
const intent = await cleared.getOrCreateJobIntent({
  idempotencyKey: req.header("Idempotency-Key"),
  buyerKey: req.body.agentId,
  jobType: "account_research",
  inputHash,
  price: {
    amount: "0.75",
    currency: "USDC",
    network: "base",
  },
  payload: req.body,
});
```

### Input

```ts
export type GetOrCreateJobIntentInput = {
  /**
   * Stable client-provided idempotency key.
   */
  idempotencyKey: string;

  /**
   * Stable buyer identity inside the seller application.
   */
  buyerKey: string;

  /**
   * Application-defined job type.
   */
  jobType: string;

  /**
   * Deterministic hash of the requested work.
   */
  inputHash: string;

  /**
   * Price and network for the payment requirement.
   */
  price: JobPrice;

  /**
   * Application payload to store with the intent.
   */
  payload: Record<string, unknown>;

  /**
   * Optional expiration time for the job intent.
   */
  expiresAt?: string;

  /**
   * Optional metadata.
   */
  metadata?: Record<string, unknown>;
};
```

---

## `admitPaidJob()`

Lower-level API for admitting a job after payment has already been verified.

Use this if your app already handles job intent creation and x402 verification separately.

```ts
export async function admitPaidJob(
  input: AdmitPaidJobInput,
): Promise<AdmitPaidJobResult>;
```

### Example

```ts
const receipt = await cleared.admitPaidJob({
  paymentId: req.x402.paymentId,
  payer: req.x402.payer,
  amount: req.x402.amount,
  currency: "USDC",
  network: req.x402.network,

  jobType: "account_research",
  inputHash,

  payload: {
    companyQuery,
    requestedRows: 25,
  },

  enqueue: async ({ jobId }) => {
    await queue.add("account_research", { jobId });
  },
});
```

### Input

```ts
export type AdmitPaidJobInput = {
  /**
   * Stable identifier for the verified payment.
   *
   * One paymentId can admit at most one JobId.
   */
  paymentId: string;

  /**
   * Optional pre-job intent id.
   *
   * If provided, the job is attached to an existing job intent.
   */
  intentId?: string;

  /**
   * Payer identity from the verified payment.
   */
  payer: string;

  /**
   * Recipient wallet/account, if available.
   */
  payTo?: string;

  /**
   * Paid amount.
   */
  amount: string;

  /**
   * Payment currency.
   */
  currency: "USDC";

  /**
   * Payment network.
   *
   * Examples:
   * - "base"
   * - "base-sepolia"
   * - "solana-devnet"
   * - "solana-mainnet"
   */
  network: string;

  /**
   * Optional transaction hash or settlement reference.
   */
  txHash?: string;

  /**
   * Application-defined job type.
   */
  jobType: string;

  /**
   * Deterministic hash of the requested work.
   */
  inputHash: string;

  /**
   * Payload stored with the admitted job.
   */
  payload: Record<string, unknown>;

  /**
   * Optional queue handoff after durable admission.
   */
  enqueue?: (args: EnqueueArgs) => Promise<void>;

  /**
   * Optional metadata stored with the job.
   */
  metadata?: Record<string, unknown>;
};
```

### Result

```ts
export type AdmitPaidJobResult = {
  /**
   * Whether this call created a new job or returned an existing one.
   */
  type: "admitted" | "already_admitted";

  /**
   * Canonical durable job id.
   */
  jobId: string;

  /**
   * Current job status.
   */
  status: JobStatus;

  /**
   * Payment id connected to this job.
   */
  paymentId: string;

  /**
   * Intent id, if the job was admitted from a job intent.
   */
  intentId?: string;
};
```

---

## `startJob()`

Marks a job as running.

Usually called by a worker when it begins processing a job.

```ts
export async function startJob(
  jobId: string,
  input?: StartJobInput,
): Promise<JobRecord>;
```

### Example

```ts
await cleared.startJob(jobId, {
  workerId: "worker_1",
});
```

### Input

```ts
export type StartJobInput = {
  /**
   * Optional worker identity for audit/debugging.
   */
  workerId?: string;

  /**
   * Optional metadata about the attempt.
   */
  metadata?: Record<string, unknown>;
};
```

### Behavior

`startJob()` records a job attempt and transitions the job into `running`.

If the job has already completed, the function should not move it back to `running`.

Recommended behavior:

```txt
admitted/queued → running
running        → running
completed      → completed
failed         → failed
manual_review  → manual_review
refund_due     → refund_due
```

---

## `completeJob()`

Marks a job as completed and stores its result.

Usually called by a worker after successful execution.

```ts
export async function completeJob(
  jobId: string,
  input: CompleteJobInput,
): Promise<JobRecord>;
```

### Example

```ts
await cleared.completeJob(jobId, {
  result: {
    rowsCreated: 25,
    outputUrl: "https://example.com/result.csv",
  },
});
```

### Input

```ts
export type CompleteJobInput = {
  /**
   * Final job result.
   *
   * Can be inline JSON, a file URL, object storage reference,
   * or application-specific result object.
   */
  result: Record<string, unknown>;

  /**
   * Optional result content type.
   *
   * Examples:
   * - "application/json"
   * - "text/csv"
   * - "application/pdf"
   */
  resultType?: string;

  /**
   * Optional metadata stored with the completion event.
   */
  metadata?: Record<string, unknown>;
};
```

### Behavior

`completeJob()` stores the final result and transitions the job into `completed`.

Recommended behavior:

```txt
running/admitted/queued → completed
completed              → completed
failed/manual_review   → unchanged unless explicitly force-resolved
refund_due             → unchanged unless explicitly force-resolved
```

The result should be immutable by default. Updating or replacing a completed result should require a separate operator-level function, not a normal worker completion call.

---

## `failJob()`

Marks a job as failed.

Use this when the worker cannot complete the job.

```ts
export async function failJob(
  jobId: string,
  input: FailJobInput,
): Promise<JobRecord>;
```

### Example

```ts
await cleared.failJob(jobId, {
  reason: "Source website timed out",
  resolution: "manual_review",
});
```

### Input

```ts
export type FailJobInput = {
  /**
   * Human-readable failure reason.
   */
  reason: string;

  /**
   * What should happen after failure.
   */
  resolution: JobFailureResolution;

  /**
   * Optional machine-readable error code.
   */
  errorCode?: string;

  /**
   * Optional metadata for debugging.
   */
  metadata?: Record<string, unknown>;
};
```

```ts
export type JobFailureResolution =
  | "retryable"
  | "manual_review"
  | "refund_due"
  | "terminal_failed";
```

### Behavior

`failJob()` records failure and sets the next resolution state.

Recommended status mapping:

```txt
retryable       → failed
manual_review   → manual_review
refund_due      → refund_due
terminal_failed → failed
```

---

## `getJob()`

Loads the current state of a job.

Usually used by status endpoints, dashboards, agents, or recovery flows.

```ts
export async function getJob(jobId: string): Promise<JobRecord | null>;
```

### Example

```ts
app.get("/jobs/:jobId", async (req, res) => {
  const job = await cleared.getJob(req.params.jobId);

  if (!job) {
    return res.status(404).json({ error: "Job not found" });
  }

  return res.json(job);
});
```

---

## `getResult()`

Loads the final result for a completed job.

Returns `null` if the job has not completed or no result exists yet.

```ts
export async function getResult(jobId: string): Promise<JobResult | null>;
```

### Example

```ts
app.get("/jobs/:jobId/result", async (req, res) => {
  const result = await cleared.getResult(req.params.jobId);

  if (!result) {
    return res.status(404).json({
      error: "Result not available",
    });
  }

  return res.json(result);
});
```

---

# Shared Types

## `JobPrice`

```ts
export type JobPrice = {
  /**
   * Price amount as a decimal string.
   *
   * Examples:
   * - "0.05"
   * - "1.00"
   * - "25.00"
   */
  amount: string;

  /**
   * Payment currency.
   */
  currency: "USDC";

  /**
   * Payment network.
   *
   * Examples:
   * - "base"
   * - "base-sepolia"
   * - "solana-devnet"
   * - "solana-mainnet"
   */
  network: string;
};
```

---

## `VerifiedX402Payment`

```ts
export type VerifiedX402Payment = {
  /**
   * Stable payment identifier produced by the x402 verification layer.
   */
  paymentId: string;

  /**
   * Payer wallet/account.
   */
  payer: string;

  /**
   * Recipient wallet/account.
   */
  payTo?: string;

  /**
   * Paid amount.
   */
  amount: string;

  /**
   * Payment currency.
   */
  currency: "USDC";

  /**
   * Payment network.
   */
  network: string;

  /**
   * Optional transaction hash or settlement reference.
   */
  txHash?: string;

  /**
   * Raw verified payment payload from the x402 library/facilitator.
   */
  raw?: unknown;
};
```

---

## `JobIntentStatus`

```ts
export type JobIntentStatus =
  | "requires_payment"
  | "paid"
  | "expired"
  | "cancelled";
```

---

## `JobIntentRecord`

```ts
export type JobIntentRecord = {
  /**
   * Stable pre-job intent id.
   */
  intentId: string;

  /**
   * Client-provided idempotency key.
   */
  idempotencyKey: string;

  /**
   * Stable buyer identity inside the seller application.
   */
  buyerKey: string;

  /**
   * Application-defined job type.
   */
  jobType: string;

  /**
   * Deterministic hash of the requested work.
   */
  inputHash: string;

  /**
   * Price and network for the payment requirement.
   */
  price: JobPrice;

  /**
   * Stored application payload.
   */
  payload: Record<string, unknown>;

  /**
   * Current job intent status.
   */
  status: JobIntentStatus;

  /**
   * Associated job id, if the intent has been funded and admitted.
   */
  jobId?: string;

  /**
   * Associated payment id, if payment has been verified.
   */
  paymentId?: string;

  /**
   * Timestamps.
   */
  createdAt: string;
  updatedAt: string;
  expiresAt?: string;

  /**
   * Optional metadata.
   */
  metadata?: Record<string, unknown>;
};
```

---

## `JobStatus`

```ts
export type JobStatus =
  | "admitted"
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "manual_review"
  | "refund_due";
```

---

## `JobRecord`

```ts
export type JobRecord = {
  /**
   * Canonical durable job id.
   */
  jobId: string;

  /**
   * Stable job intent id, if the job came from a job intent.
   */
  intentId?: string;

  /**
   * Verified payment id, if payment has been attached.
   */
  paymentId?: string;

  /**
   * Payer wallet/account, if available.
   */
  payer?: string;

  /**
   * Recipient wallet/account, if available.
   */
  payTo?: string;

  /**
   * Paid amount, if available.
   */
  amount?: string;

  /**
   * Payment currency.
   */
  currency?: "USDC";

  /**
   * Payment network.
   */
  network?: string;

  /**
   * Optional transaction hash or settlement reference.
   */
  txHash?: string;

  /**
   * Application-defined job type.
   */
  jobType: string;

  /**
   * Current job status.
   */
  status: JobStatus;

  /**
   * Deterministic hash of the requested work.
   */
  inputHash: string;

  /**
   * Application payload stored with the job.
   */
  payload: Record<string, unknown>;

  /**
   * Timestamps.
   */
  createdAt: string;
  updatedAt: string;
  queuedAt?: string;
  startedAt?: string;
  completedAt?: string;
  failedAt?: string;

  /**
   * Optional failure reason.
   */
  failureReason?: string;

  /**
   * Optional failure resolution.
   */
  failureResolution?: JobFailureResolution;

  /**
   * Optional metadata.
   */
  metadata?: Record<string, unknown>;
};
```

---

## `JobResult`

```ts
export type JobResult = {
  /**
   * Job this result belongs to.
   */
  jobId: string;

  /**
   * Stored result payload.
   */
  result: Record<string, unknown>;

  /**
   * Optional result content type.
   */
  resultType?: string;

  /**
   * Time result was stored.
   */
  createdAt: string;
};
```

---

## `EnqueueArgs`

```ts
export type EnqueueArgs = {
  /**
   * Canonical durable job id.
   */
  jobId: string;

  /**
   * Application-defined job type.
   */
  jobType: string;

  /**
   * Stored application payload.
   */
  payload: Record<string, unknown>;
};
```

---

# Recommended HTTP Semantics

## Missing Idempotency Key

Paid async endpoints should require an idempotency key.

```txt
400 Bad Request
```

Example response:

```json
{
  "error": "Missing Idempotency-Key header"
}
```

---

## Payment Required

When no valid payment is attached, return Cleared’s payment requirement as HTTP 402.

```txt
402 Payment Required
```

Example response:

```json
{
  "intentId": "intent_123",
  "accepts": [
    {
      "network": "solana-devnet",
      "amount": "0.05",
      "currency": "USDC"
    }
  ]
}
```

The exact response shape depends on the active x402 adapter.

---

## Job Accepted

After payment is verified and the job is admitted, return HTTP 202.

```txt
202 Accepted
```

Example response:

```json
{
  "jobId": "job_123",
  "status": "queued",
  "resultUrl": "/jobs/job_123/result"
}
```

---

## Existing Job Returned

If the same paid request is retried, return the existing job.

Recommended status:

```txt
200 OK
```

or:

```txt
202 Accepted
```

Example response:

```json
{
  "jobId": "job_123",
  "status": "running",
  "resultUrl": "/jobs/job_123/result"
}
```

---

# Recommended Flow

## 1. Paid Route

```ts
const result = await cleared.handlePaidJobRequest({
  idempotencyKey: req.header("Idempotency-Key"),
  buyerKey: req.body.agentId,
  jobType: "quest_submission",
  inputHash,
  price: {
    amount: "0.05",
    currency: "USDC",
    network: "solana-devnet",
  },
  payload: req.body,
  payment: req.x402?.payment,
  enqueue: async ({ jobId }) => {
    await queue.add("quest_submission", { jobId });
  },
});

if (result.type === "payment_required") {
  return res.status(402).json(result.paymentRequirement);
}

return res.status(202).json({
  jobId: result.jobId,
  status: result.status,
  resultUrl: `/jobs/${result.jobId}/result`,
});
```

---

## 2. Worker

```ts
export async function processJob(jobId: string) {
  await cleared.startJob(jobId);

  try {
    const job = await cleared.getJob(jobId);

    if (!job) {
      throw new Error("Job not found");
    }

    const result = await runWork(job.payload);

    await cleared.completeJob(jobId, {
      result,
    });
  } catch (error) {
    await cleared.failJob(jobId, {
      reason: error instanceof Error ? error.message : "Unknown error",
      resolution: "manual_review",
    });
  }
}
```

---

## 3. Status Endpoint

```ts
app.get("/jobs/:jobId", async (req, res) => {
  const job = await cleared.getJob(req.params.jobId);

  if (!job) {
    return res.status(404).json({ error: "Job not found" });
  }

  return res.json(job);
});
```

---

## 4. Result Endpoint

```ts
app.get("/jobs/:jobId/result", async (req, res) => {
  const result = await cleared.getResult(req.params.jobId);

  if (!result) {
    return res.status(404).json({
      error: "Result not available",
    });
  }

  return res.json(result);
});
```

---

# Storage Requirements

A production storage adapter should enforce these rules at the database level where possible.

## Payment Intent Uniqueness

The same buyer and idempotency key should resolve to one job intent.

Recommended uniqueness:

```txt
buyerKey + idempotencyKey
```

If the same idempotency key is reused with a different `inputHash`, the adapter should return an error instead of silently creating another intent.

---

## Payment Uniqueness

The same verified payment should admit at most one job.

Recommended uniqueness:

```txt
network + paymentId
```

---

## Job Identity

Once admitted, `jobId` should be the canonical identifier for:

```txt
status
worker attempts
result retrieval
failure state
manual review
audit events
```

---

## Queue Handoff

For production, Cleared should use an outbox pattern or equivalent durable handoff.

The risky case is:

```txt
payment verified
job admitted
process crashes before queue push
```

A durable outbox allows the queue push to be retried without creating a duplicate job.

---

# x402 Integration

Cleared should use official x402 libraries or facilitators for:

```txt
payment requirement generation
wallet signing
payment verification
settlement
payment headers
chain-specific logic
```

Cleared should own:

```txt
job intent
paid job admission
job status
worker attempts
result recovery
failure resolution
audit trail
```

The split:

```txt
x402 verifies payment.
Cleared turns that paid intent into one durable async job.
```

---

# Errors

## `MissingIdempotencyKeyError`

Thrown when `handlePaidJobRequest()` is called without an idempotency key.

```ts
class MissingIdempotencyKeyError extends Error {
  code: "MISSING_IDEMPOTENCY_KEY";
}
```

---

## `IdempotencyConflictError`

Thrown when the same idempotency key is reused for different input.

```ts
class IdempotencyConflictError extends Error {
  code: "IDEMPOTENCY_CONFLICT";
  existingInputHash: string;
  receivedInputHash: string;
}
```

---

## `PaymentAlreadyAdmittedError`

Thrown when a payment is already attached to a different job or intent.

```ts
class PaymentAlreadyAdmittedError extends Error {
  code: "PAYMENT_ALREADY_ADMITTED";
  paymentId: string;
  jobId: string;
}
```

---

## `JobNotFoundError`

Thrown by lifecycle functions when the job does not exist.

```ts
class JobNotFoundError extends Error {
  code: "JOB_NOT_FOUND";
  jobId: string;
}
```

---

## `InvalidJobTransitionError`

Thrown when a lifecycle function tries to perform an invalid state transition.

```ts
class InvalidJobTransitionError extends Error {
  code: "INVALID_JOB_TRANSITION";
  jobId: string;
  from: JobStatus;
  to: JobStatus;
}
```

---

# Design Notes

Cleared is intentionally small.

It is not a wallet SDK, not an x402 facilitator, not a marketplace, and not a generic queue. It is a durable job lifecycle layer for paid async work.

The most important guarantees are:

```txt
one intent → one paid job
one payment → one admission
one jobId → one recoverable result
```
