import express from 'express';
import { 
  createQuote, 
  admitFundedJob, 
  getJobStatus, 
  getJobResult,
  dispatchJob,
  SystemClock,
  createJobTemplateId,
  createJobId,
  QuoteId
} from '@cleared/core';
import { MemoryStorage } from '@cleared/storage-memory';
import { MockX402Adapter } from '@cleared/payment-x402';
import { 
  sendPaymentRequired, 
  sendJobAccepted, 
  sendJobResult, 
  clearedErrorHandler,
  sendError
} from '@cleared/http-402-express';
import { CallbackClient, FakeWorker } from '@cleared/worker-adapter';

const app = express();
app.use(express.json());

// 1. Initialize Infrastructure (Hexagonal Ports)
const storage = new MemoryStorage();
const clock = new SystemClock();

// Configure the mock payment adapter
const payments = new MockX402Adapter({
  recipientAddress: '0xClearingHouseAddr',
  network: 'sepolia',
  asset: 'USDC'
});

// Configure the local worker shim
const callbackClient = new CallbackClient(storage, payments, clock);
const fakeWorker = new FakeWorker(callbackClient);

// Implement a simple worker dispatcher for the demo
const workerPort = {
  dispatch: async (job: any) => {
    // In this demo, we just trigger the fake worker in the background
    console.log(`[Demo] Dispatching job ${job.jobId} to fake worker...`);
    fakeWorker.process(job).catch(err => {
      console.error(`[Demo] Worker error for job ${job.jobId}:`, err);
    });
  },
  cancel: async (jobId: any) => {
    console.log(`[Demo] Cancelled job ${jobId}`);
  }
};

// 2. Seed Job Template
const TEMPLATE_ID = createJobTemplateId('tmpl_batch_enrichment_v1');
storage.seedTemplates([{
  id: TEMPLATE_ID,
  name: 'Batch Enrichment V1',
  description: 'AI-powered batch data enrichment and cleaning',
  priceAmount: 1000000n, // $1.00 in 6-decimal USDC
  priceCurrency: 'USDC',
  inputSchema: { type: 'object' },
  outputSchema: { type: 'object' },
  slaSeconds: 60,
  timeoutPolicy: 'REFUND',
  createdAt: clock.now()
}]);

// 3. Public API Endpoints

/**
 * Main entry point: POST /v1/jobs/run
 */
app.post('/v1/jobs/run', async (req, res, next) => {
  const { payment_proof, payment_identifier, inputs } = req.body;

  try {
    // SCENARIO 1: No payment proof -> Generate Quote
    if (!payment_proof) {
      console.log('[API] No payment proof found. Creating quote...');
      const quoteResult = await createQuote(
        {
          templateId: TEMPLATE_ID,
          buyerId: 'demo-user-123',
          inputs: inputs || {}
        },
        storage,
        payments,
        clock
      );
      return sendPaymentRequired(res, quoteResult);
    }

    // SCENARIO 2: Payment proof present -> Admit Job
    console.log('[API] Verifying payment proof...');
    const admission = await admitFundedJob(
      {
        quoteId: req.body.quote_id as QuoteId,
        paymentIdentifier: payment_identifier,
        paymentProof: payment_proof,
        inputs: inputs || {}
      },
      storage,
      payments,
      clock
    );

    // Initial dispatch if not a replay
    if (!admission.replayed) {
      await dispatchJob(admission.jobId, storage, workerPort, clock);
    }

    return sendJobAccepted(res, admission.jobId, admission.replayed);

  } catch (err) {
    next(err);
  }
});

/**
 * Poll Job Status
 */
app.get('/v1/jobs/:jobId', async (req, res, next) => {
  try {
    const jobId = createJobId(req.params.jobId);
    const status = await getJobStatus({ jobId }, storage);
    res.json(status);
  } catch (err) {
    next(err);
  }
});

/**
 * ADMIN: Trigger timeout evaluation scan
 */
app.post('/admin/timeout-scan', async (req, res, next) => {
  try {
    const { evaluateTimeouts } = await import('@cleared/core');
    const count = await evaluateTimeouts(storage, payments, clock);
    res.json({ scanned: true, timedOutCount: count });
  } catch (err) {
    next(err);
  }
});

/**
 * ADMIN: Manually trigger refund
 */
app.post('/admin/jobs/:jobId/refund', async (req, res, next) => {
  try {
    const { operatorMarkRefund } = await import('@cleared/core');
    const jobId = createJobId(req.params.jobId);
    await operatorMarkRefund(jobId, 'admin-1', 'Manual refund via support', storage, payments, clock);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

/**
 * ADMIN: Transition to manual review
 */
app.post('/admin/jobs/:jobId/review', async (req, res, next) => {
  try {
    const { operatorMarkManualReview } = await import('@cleared/core');
    const jobId = createJobId(req.params.jobId);
    await operatorMarkManualReview(jobId, 'admin-1', 'Complex case review', storage, clock);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

/**
 * Get Job Result
 */
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

// 4. Debug/Internal Endpoints
app.get('/debug/jobs/:jobId/audit', async (req, res) => {
  // Directly access storage for simplicity in debug
  const jobId = req.params.jobId;
  const allLogs: any[] = (storage as any).auditLogs;
  const filtered = allLogs.filter(l => l.resourceId === jobId);
  res.json(filtered);
});

app.get('/debug/jobs/:jobId/events', async (req, res) => {
  const jobId = req.params.jobId;
  const events = await storage.listDomainEventsByAggregateId(jobId);
  res.json(events);
});

// 5. Wire Middleware
app.use(clearedErrorHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('---------------------------------------------------------');
  console.log(`CLEARED SELLER API RUNNING ON http://localhost:${PORT}`);
  console.log(`Template Seeded: ${TEMPLATE_ID}`);
  console.log('---------------------------------------------------------');
});
