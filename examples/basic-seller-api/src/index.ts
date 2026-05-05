import express from 'express';
import { randomUUID } from 'crypto';
import { 
  createCleared,
  SystemClock,
  hashInputs,
} from '@cleared/core';
import { MemoryStorage } from '@cleared/storage-memory';
import { MockX402Adapter } from '@cleared/x402-mock';

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
  
  if (err.code === 'JOB_INTENT_EXPIRED') {
    return sendError(res, 402, 'JOB_INTENT_EXPIRED', err.message);
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

const cleared = createCleared({ storage, clock });

const callbackClient = new CallbackClient(storage, clock);
const fakeWorker = new FakeWorker(callbackClient);

const JOB_TYPE = 'tmpl_batch_enrichment_v1';

app.post('/v1/jobs/run', async (req, res, next) => {
  const { payment_proof, payment_identifier, inputs, idempotency_key } = req.body;

  try {
    const inputHash = hashInputs(JOB_TYPE, inputs || {});
    
    let payment = undefined;
    if (payment_proof) {
      const verification = await payments.verifyProof(payment_proof);
      if (verification.verified) {
        payment = {
          paymentId: verification.paymentIdentifier,
          payer: '0xBuyer',
          amount: verification.amount.toString(),
          currency: verification.currency as 'USDC',
          network: 'test',
        };
      } else {
        return sendError(res, 400, 'INVALID_PAYMENT_PROOF', 'The provided payment proof is invalid.');
      }
    }

    const result = await cleared.handlePaidJobRequest(
      {
        idempotencyKey: idempotency_key || randomUUID(),
        buyerKey: 'demo-user-123',
        jobType: JOB_TYPE,
        inputHash,
        price: { amount: '1', currency: 'USDC', network: 'test' },
        payload: inputs || {},
        payment,
        enqueue: async ({ jobId }) => {
          console.log(`[Demo] Dispatching job ${jobId} to fake worker...`);
          // simulate async dispatch
          setTimeout(() => {
            cleared.getJob(jobId).then(job => {
              if (job) {
                fakeWorker.process({ id: job.jobId, inputs: job.payload, executionId: randomUUID() } as any).catch(console.error);
              }
            });
          }, 0);
        }
      },
      storage,
      clock,
      async (intentId) => {
        // Generate requirement dynamically
        const req = await payments.createIntent({
          id: idempotency_key || randomUUID(),
          priceAmount: 1000000n,
          priceCurrency: 'USDC'
        } as any);
        return req;
      }
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
    const status = await cleared.getJob(req.params.jobId);
    res.json(status);
  } catch (err) {
    next(err);
  }
});

app.get('/v1/jobs/:jobId/result', async (req, res, next) => {
  try {
    const resultResponse = await cleared.getResult(req.params.jobId);
    
    if (!resultResponse || !resultResponse.result) {
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
