import express from "express";
import { randomUUID } from "crypto";
import { createCleared, SystemClock, hashJobInput } from "@clearedink/core";
import { MemoryStorage } from "@clearedink/storage-memory";
import { MockX402Adapter } from "@clearedink/x402-mock";

function sendPaymentRequired(res: express.Response, result: any) {
  return res.status(402).json({
    error: "PAYMENT_REQUIRED",
    message: "Payment is required to process this request.",
    ...result,
  });
}

function sendJobAccepted(
  res: express.Response,
  jobId: string,
  alreadyAdmitted: boolean = false,
) {
  return res.status(202).json({
    status: "accepted",
    jobId,
    alreadyAdmitted,
    pollUrl: `/v1/jobs/${jobId}`,
    resultUrl: `/v1/jobs/${jobId}/result`,
  });
}

function sendJobResult(res: express.Response, result: any) {
  return res.status(200).json({
    status: "completed",
    ...result,
  });
}

function sendError(
  res: express.Response,
  status: number,
  code: string,
  message: string,
) {
  return res.status(status).json({
    error: code,
    message,
  });
}

function clearedErrorHandler(
  err: any,
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
) {
  if (err.name === "DomainError") {
    return sendError(res, 400, err.code, err.message);
  }

  if (err.code === "JOB_INTENT_EXPIRED") {
    return sendError(res, 402, "JOB_INTENT_EXPIRED", err.message);
  }

  next(err);
}

import { CallbackClient, FakeWorker } from "./fake-worker.js";

const app = express();
app.use(express.json());

const storage = new MemoryStorage();
const clock = new SystemClock();

const payments = new MockX402Adapter({
  recipientAddress: "0xClearingHouseAddr",
  network: "sepolia",
  asset: "USDC",
});

const cleared = createCleared({ storage, clock });

const callbackClient = new CallbackClient(storage, clock);
const fakeWorker = new FakeWorker(callbackClient);

const JOB_TYPE = "tmpl_batch_enrichment_v1";

app.post("/v1/jobs/run", async (req, res, next) => {
  const {
    intent_id,
    payment_proof,
    payment_identifier,
    inputs,
    idempotency_key,
  } = req.body;

  if (intent_id) {
    console.log(`[Demo] Received admission request for intent: ${intent_id}`);
  }

  try {
    const inputHash = hashJobInput(JOB_TYPE, inputs || {});

    let payment = undefined;

    if (payment_proof) {
      try {
        const parsedProof =
          typeof payment_proof === "string"
            ? JSON.parse(payment_proof)
            : payment_proof;

        const normalizedProof = {
          paymentIdentifier:
            parsedProof.paymentIdentifier ??
            parsedProof.payment_identifier ??
            req.body.payment_identifier ??
            req.body.payment_id ??
            intent_id,

          signature:
            parsedProof.signature ??
            parsedProof.paymentSignature ??
            parsedProof.payment_signature ??
            "mock-proof-sig",

          transactionHash:
            parsedProof.transactionHash ?? parsedProof.transaction_hash,
        };

        payment = payments.verifyMockPaymentProof(normalizedProof, {
          amount: "1",
          currency: "USDC",
          network: "test",
        });
      } catch (err) {
        console.error("[Demo] Invalid payment proof:", {
          payment_proof,
          err,
        });

        return sendError(
          res,
          400,
          "INVALID_PAYMENT_PROOF",
          "The provided payment proof is invalid.",
        );
      }
    }

    const result = await cleared.handlePaidJobRequest(
      {
        idempotencyKey: idempotency_key || randomUUID(),
        buyerKey: "demo-user-123",
        jobType: JOB_TYPE,
        inputHash,
        price: { amount: "1", currency: "USDC", network: "test" },
        payload: inputs || {},
        payment,
        enqueue: async ({ jobId }) => {
          console.log(`[Demo] Dispatching job ${jobId} to fake worker...`);
          // simulate async dispatch
          setTimeout(() => {
            cleared.getJob(jobId).then((job) => {
              if (job) {
                fakeWorker
                  .process({
                    jobId: job.jobId,
                    inputs: job.payload,
                    executionId: randomUUID(),
                  })
                  .catch(console.error);
              }
            });
          }, 0);
        },
      },
      async (intent) => {
        // Generate requirement dynamically
        return payments.createMockPaymentRequirement(intent);
      },
    );

    if (result.type === "payment_required") {
      return sendPaymentRequired(res, result);
    }

    return sendJobAccepted(
      res,
      result.jobId,
      result.type === "already_admitted",
    );
  } catch (err) {
    next(err);
  }
});

app.get("/v1/jobs/:jobId", async (req, res, next) => {
  try {
    const status = await cleared.getJob(req.params.jobId);
    res.json(status);
  } catch (err) {
    next(err);
  }
});

app.get("/v1/jobs/:jobId/result", async (req, res, next) => {
  try {
    const resultResponse = await cleared.getResult(req.params.jobId);

    if (!resultResponse || !resultResponse.result) {
      return sendError(
        res,
        404,
        "RESULT_NOT_READY",
        "Job result is not ready yet",
      );
    }

    return sendJobResult(res, resultResponse.result);
  } catch (err) {
    next(err);
  }
});

// --- Admin & Debug Endpoints ---

app.post("/admin/timeout-scan", async (req, res) => {
  // Mocked timeout scan
  return res.json({ scanned: 1, timedOut: 0 });
});

app.post("/admin/jobs/:jobId/refund", async (req, res, next) => {
  try {
    const job = await cleared.failJob(req.params.jobId, {
      reason: "Admin override",
      resolution: "refund_due",
    });
    return res.json(job);
  } catch (err) {
    next(err);
  }
});

app.get("/debug/jobs/:jobId/audit", async (req, res) => {
  const auditLogs = (storage as MemoryStorage).getAuditLogs();
  const filtered = auditLogs.filter(
    (log) => log.resourceId === req.params.jobId,
  );
  return res.json(filtered);
});

app.use(clearedErrorHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("---------------------------------------------------------");
  console.log(`CLEARED SELLER API RUNNING ON http://localhost:${PORT}`);
  console.log("---------------------------------------------------------");
});
