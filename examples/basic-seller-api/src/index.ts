import express from 'express';
import { randomUUID } from 'crypto';
import { 
  handlePaidJobRequest, 
  getJobStatus, 
  getJobResult,
  SystemClock,
  createJobTemplateId,
  createJobId,
  hashInputs,
  dispatchJob
} from '@cleared/core';
import { MemoryStorage } from '@cleared/storage-memory';
import { MockX402Adapter } from '@cleared/payment-x402';

/**
 * -----------------------------------------------------------------------------
 * HTTP HELPERS
 * -----------------------------------------------------------------------------
 */

function sendPaymentRequired(res: express.Response, result: any) {
  return res.status(402).json({
    error: 'PAYMENT_REQUIRED',
    message: 'Payment is required to process this request.',
    ...result
  });
}

function sendJobAccepted(res: express.Response, jobId: string, replayed: boolean = false) {
  return res.status(202).json({
    status: 'ACCEPTED',
    jobId,
    replayed,
    pollUrl: `/jobs/${jobId}/status`
  });
}

function sendJobResult(res: express.Response, result: any) {
  return res.status(200).json({
    status: 'COMPLETED',
    ...result
  });
}

function sendError(res: express.Response, status: number, code: string, message: string) {
  return res.status(status).json({
    error: code,
    message
  });
}

function clearedErrorHandler(err: any, req: express.Request, res: express.Response, next: express.NextFunction) {
  if (err.name === 'DomainError') {
    return sendError(res, 400, err.code, err.message);
  }
  
  if (err.code === 'PAYMENT_INTENT_EXPIRED') {
    return sendError(res, 402, 'PAYMENT_INTENT_EXPIRED', err.message);
  }

  next(err);
}

import { CallbackClient, FakeWorker } from '../../tests/fake-worker';

const app = express();
app.use(express.json());

const storage = new MemoryStorage();
const clock = new SystemClock();

const payments = new MockX402Adapter({
  recipientAddress: '0xClearingHouseAddr',
  network: 'sepolia',
  asset: 'USDC'
});

const callbackClient = new CallbackClient(storage, payments, clock);
const fakeWorker = new FakeWorker(callbackClient);

const workerPort = {
  dispatch: async (job: any) => {
    console.log(`[Demo] Dispatching job ${job.id} to fake worker...`);
    fakeWorker.process(job).catch(err => {
      console.error(`[Demo] Worker error for job ${job.id}:`, err);
    });
  },
  cancel: async (jobId: any) => {
    console.log(`[Demo] Cancelled job ${jobId}`);
  }
};

const JOB_TYPE = 'tmpl_batch_enrichment_v1';
const TEMPLATE_ID = createJobTemplateId(JOB_TYPE);

storage.seedTemplates([{
  id: TEMPLATE_ID,
  name: 'Batch Enrichment V1',
  description: 'AI-powered batch data enrichment and cleaning',
  priceAmount: 1000000n,
  priceCurrency: 'USDC',
  inputSchema: { type: 'object' },
  outputSchema: { type: 'object' },
  slaSeconds: 60,
  timeoutPolicy: 'REFUND',
  createdAt: clock.now()
}]);

/**
 * Main entry point: POST /v1/jobs/run
 */
app.post('/v1/jobs/run', async (req, res, next) => {
  const { payment_proof, payment_identifier, inputs, idempotency_key } = req.body;

  try {
    const inputHash = hashInputs(JOB_TYPE, inputs || {});

    const result = await handlePaidJobRequest(
      {
        idempotencyKey: idempotency_key || randomUUID(),
        buyerKey: 'demo-user-123',
        jobType: JOB_TYPE,
        inputHash,
        price: { amount: '1000000', currency: 'USDC' },
        payload: inputs || {},
        payment: payment_proof ? {
          paymentIdentifier: payment_identifier,
          paymentProof: payment_proof
        } : undefined,
        enqueue: async ({ jobId }) => {
          // Trigger the fake worker dispatcher
          await dispatchJob(jobId, storage, workerPort, clock);
        }
      },
      storage,
      payments,
      clock
    );

    if (result.type === 'payment_required') {
      return sendPaymentRequired(res, result);
    }

    return sendJobAccepted(res, result.jobId, result.type === 'already_accepted');

  } catch (err) {
    next(err);
  }
});

app.get('/v1/jobs/:jobId', async (req, res, next) => {
  try {
    const jobId = createJobId(req.params.jobId);
    const status = await getJobStatus({ jobId }, storage);
    res.json(status);
  } catch (err) {
    next(err);
  }
});

app.get('/v1/jobs/:jobId/result', async (req, res, next) => {
  try {
    const jobId = createJobId(req.params.jobId);
    const resultResponse = await getJobResult({ jobId }, storage);
    
    if (!resultResponse.result) {
      return sendError(res, 404, 'RESULT_NOT_READY', 'Job result is not ready yet');
    }

    return sendJobResult(res, resultResponse.result);
  } catch (err) {
    next(err);
  }
});

app.use(clearedErrorHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('---------------------------------------------------------');
  console.log(`CLEARED SELLER API RUNNING ON http://localhost:${PORT}`);
  console.log('---------------------------------------------------------');
});
