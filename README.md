The file is currently saved in the session's backend execution environment as `cleared-jobs-sdk.md`.

If your interface did not render a downloadable link, it means the frontend you are using does not natively support direct file extraction from this sandbox.

To resolve this immediately without relying on the UI, copy the raw markdown below and save it locally as a `.md` file:

````markdown
# Cleared Jobs SDK

**Cleared** turns a verified x402 payment into one durable, retry-safe async job.

x402 verifies that payment happened. Cleared records what paid work that payment belongs to, admits it exactly once, tracks execution, and keeps the result recoverable by `JobId`.

---

## The Problem

x402 is a strong payment primitive, but payment alone is not enough for long-running work.

For simple paid resources, the flow is straightforward:

```txt
request → 402 payment required → pay → retry → response
```
````

That works well for short API calls. But paid async jobs are different:

```txt
pay → queue job → worker runs → result later
```

Once work becomes asynchronous, several things can go wrong:

- The buyer opens the same paid endpoint twice and receives two unrelated payment requirements.
- The buyer pays, but the server crashes before returning a jobId.
- The client retries after payment and accidentally creates a duplicate job.
- The worker starts but fails halfway through.
- The original caller disconnects before the result is ready.
- The seller has no canonical place to track whether the paid work is queued, running, completed, failed, or under manual review.

Most developers patch this together with Redis locks, queue IDs, and custom database rows. Cleared packages that missing layer.

## What Cleared Does

Cleared gives paid async work a durable lifecycle:

```txt
payment intent → funded admission → durable job → worker execution → result recovery
```

It handles three important moments:

- **Before payment:** Cleared creates or reuses a stable payment intent for the requested job.
- **After payment:** Cleared attaches the verified x402 payment to that intent and admits exactly one durable `JobId`.
- **During execution:** Cleared tracks job status, worker attempts, completion, failure, and result retrieval.

The core idea:

1. x402 verifies payment.
2. Cleared turns that paid intent into one durable async job.

## Quick Example

### Paid Route

Use `handlePaidJobRequest()` inside the endpoint that requires payment.

```typescript
// 1. Get or Create Intent
if (!req.body.payment_proof) {
  const intent = await cleared.getOrCreatePaymentIntent({
    idempotencyKey: req.header("Idempotency-Key"),
    buyerKey: req.body.agentId,
    jobType: "quest_submission",
    inputHash,
    price: { amount: "1000000", currency: "USDC" },
    payload: { questId, agentId, submissionUrl },
  });
  return res.status(402).json(intent.paymentRequirement);
}

// 2. Admit Job
const result = await cleared.admitFundedJob({
  paymentIntentId: req.body.payment_intent_id,
  paymentIdentifier: req.body.payment_identifier,
  paymentProof: req.body.payment_proof,
  inputs: { questId, agentId, submissionUrl },
});

return res.status(202).json({
  jobId: result.jobId,
  status: "ACCEPTED",
  resultUrl: `/jobs/${result.jobId}/result`,
});
```

### Worker

Workers can update the same durable job record from anywhere in the project.

```typescript
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

### Status Endpoint

```typescript
app.get("/jobs/:jobId", async (req, res) => {
  const job = await cleared.getJob(req.params.jobId);

  if (!job) {
    return res.status(404).json({ error: "Job not found" });
  }

  return res.json(job);
});
```

### Result Endpoint

```typescript
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

## Core API

| Function                 | Purpose                                                                                                             |
| :----------------------- | :------------------------------------------------------------------------------------------------------------------ |
| `getOrCreatePaymentIntent()` | Main paid-route helper. Creates or reuses a stable payment intent before payment. |
| `admitFundedJob()`       | Lower-level helper for admitting a job after an x402 payment has already been verified.                             |
| `startJob()`             | Marks a job as running.                                                                                             |
| `completeJob()`          | Marks a job as completed and stores the result.                                                                     |
| `failJob()`              | Marks a job as failed and records the resolution path.                                                              |
| `getJob()`               | Loads the current job state.                                                                                        |
| `getResult()`            | Loads the final result for a completed job.                                                                         |

Full function signatures and type definitions live in `docs/api.md`.

## The Happy Path

1. **Request:** Client calls a paid async endpoint with an `Idempotency-Key`.
2. **Intent:** Cleared creates or reuses a stable payment intent for the requested job.
3. **402 Response:** The service returns a `402 Payment Required` response tied to that intent.
4. **Funded Retry:** The client pays through x402 and retries the request with payment proof.
5. **Funded Admission:** Cleared attaches the verified payment to the intent and admits exactly one `JobId`.
6. **Worker Run:** A worker picks up the job and reports progress.
7. **Result Retrieval:** The client polls `GET /jobs/:jobId/result` to retrieve the final output.

## Architecture

The Cleared SDK is a TypeScript monorepo.

- `packages/core`: Domain models, status enums, admission logic, job lifecycle functions.
- `packages/x402`: Thin adapter that maps verified x402 payments into Cleared payment objects.
- `packages/storage-memory`: In-memory storage for local development and tests.
- `examples/basic-seller-api`: Runnable reference implementation.

Cleared is designed so the core does not depend on one HTTP framework, queue, or payment implementation.

Recommended production shape:

```txt
official x402 library / facilitator
        ↓
Cleared payment intent + funded admission
        ↓
durable storage
        ↓
queue / worker
        ↓
status + result retrieval
```

## Hard Rules

Cleared is built around a few rules that should remain true during retries, crashes, and worker failures.

- **One intent, one paid job:** The same `intentId` cannot create multiple funded jobs.
- **One payment, one admission:** The same verified x402 payment cannot admit more than one `JobId`.
- **Stable job identity:** Once admitted, the `JobId` is the canonical handle for status, attempts, result retrieval, and recovery.
- **Retry-safe behavior:** Repeated calls return the existing intent or job instead of creating duplicates.
- **Recoverable results:** Once a result is stored, it remains retrievable by `JobId`.
- **Separate payment and execution state:** Payment verification and settlement are tracked separately from job execution status.
- **Auditable terminal actions:** Completion, failure, manual review, and refund decisions are recorded as events.

## Demo Scripts

The repository includes demo scripts to exercise the durability model.

- `npm run demo:happy` - Standard end-to-end success.
- `npm run demo:retry` - Proves duplicate paid submissions return the same jobId.
- `npm run demo:lost` - Simulates caller disconnection and later result retrieval.
- `npm run demo:timeout` - Shows how overdue jobs can move to refund or manual review.

## Known Limitations

Cleared is currently demo-oriented.

- **Storage is not production-grade yet:** `storage-memory` is for local development and tests only. Production storage adapter planned.
- **Single-process admission is not enough for production:** Production deployments should use durable storage with database-level uniqueness constraints.
- **No production scheduler yet:** Workers are triggered through simple callbacks in the demo. A production setup should use a persistent queue such as BullMQ, SQS, Cloud Tasks, or another durable worker system.
- **x402 verification should come from official libraries:** Cleared should not replace official x402 payment libraries or facilitators.
- **Refund and settlement behavior is application-specific:** Cleared can track resolution state, but actual refund/settlement execution depends on the payment scheme and application policy.

## Out of Scope

Cleared is not:

- A general-purpose x402 payment platform.
- A wallet provisioning service.
- A treasury management system.
- A browser automation or data scraping fleet.
- A customer-facing dashboard for job management.
- A replacement for official x402 libraries.
- A replacement for a production queue.

Cleared focuses on one layer: **paid async job admission, execution state, and result recovery.**

## License

See LICENSE.

```

```
