import { describe, it, expect, beforeEach, vi } from 'vitest';
import { randomUUID } from 'crypto';
import { 
  getOrCreatePaymentIntent, 
  admitFundedJob, 
  handleWorkerCallback, 
  evaluateTimeouts,
  SystemClock,
  createJobTemplateId,
  createExecutionId,
  PaymentIntentId,
  JobStatus,
  hashInputs
} from '../index';
import { MemoryStorage } from '../../../storage-memory/src/memory-storage';
import { MockX402Adapter } from '../../../payment-x402/src/mock-x402-adapter';

// Mock worker port
const mockWorkerPort = {
  dispatch: vi.fn(),
  cancel: vi.fn()
};

describe('Job Lifecycle', () => {
  let storage: MemoryStorage;
  let payments: MockX402Adapter;
  let clock: SystemClock;
  const jobType = 'test-job';
  const templateId = createJobTemplateId(jobType);

  beforeEach(async () => {
    storage = new MemoryStorage();
    payments = new MockX402Adapter({
      recipientAddress: '0xTest',
      network: 'test',
      asset: 'USDC'
    });
    clock = new SystemClock();

    // Reset mocks
    vi.clearAllMocks();

    // Seed a template
    storage.seedTemplates([{
      id: templateId,
      name: 'Test Template',
      priceAmount: 1000n,
      priceCurrency: 'USDC',
      inputSchema: {},
      outputSchema: {},
      slaSeconds: 60,
      timeoutPolicy: 'REFUND',
      createdAt: new Date()
    }]);
  });

  it('1. getOrCreatePaymentIntent returns paymentIntentId and requirements', async () => {
    const inputs = { foo: 'bar' };
    const inputHash = hashInputs(jobType, inputs);
    const result = await getOrCreatePaymentIntent(
      {
        idempotencyKey: 'id-1',
        buyerKey: 'user-1',
        jobType,
        inputHash,
        price: { amount: '1000', currency: 'USDC' },
        payload: inputs
      },
      storage,
      payments,
      clock
    );

    expect(result.paymentIntentId).toBeDefined();
    expect(result.paymentRequirement.paymentIdentifier).toContain('x402-pt-');
    expect(result.price.amount).toBe('1000');
  });

  it('2. funded admission creates exactly one job', async () => {
    const inputs = {};
    const inputHash = hashInputs(jobType, inputs);
    const intent = await getOrCreatePaymentIntent({
      idempotencyKey: 'id-1',
      buyerKey: 'u1',
      jobType,
      inputHash,
      price: { amount: '1000', currency: 'USDC' },
      payload: inputs
    }, storage, payments, clock);
    
    const admission = await admitFundedJob(
      {
        paymentIntentId: intent.paymentIntentId,
        paymentIdentifier: intent.paymentRequirement.paymentIdentifier,
        paymentProof: JSON.stringify({
          paymentIdentifier: intent.paymentRequirement.paymentIdentifier,
          signature: 'mock-sig'
        }),
        inputs
      },
      storage,
      payments,
      clock
    );

    expect(admission.jobId).toBeDefined();
    expect(admission.replayed).toBe(false);

    const job = await storage.getJob(admission.jobId);
    expect(job).toBeDefined();
    expect(job?.status).toBe(JobStatus.FUNDED);
  });

  it('3. duplicate funded retry with same payload returns same jobId', async () => {
    const inputs = { x: 1 };
    const inputHash = hashInputs(jobType, inputs);
    const intent = await getOrCreatePaymentIntent({
      idempotencyKey: 'id-1',
      buyerKey: 'u1',
      jobType,
      inputHash,
      price: { amount: '1000', currency: 'USDC' },
      payload: inputs
    }, storage, payments, clock);

    const proof = JSON.stringify({
      paymentIdentifier: intent.paymentRequirement.paymentIdentifier,
      signature: 'sig'
    });

    const res1 = await admitFundedJob(
      { paymentIntentId: intent.paymentIntentId, paymentIdentifier: intent.paymentRequirement.paymentIdentifier, paymentProof: proof, inputs },
      storage, payments, clock
    );

    const res2 = await admitFundedJob(
      { paymentIntentId: intent.paymentIntentId, paymentIdentifier: intent.paymentRequirement.paymentIdentifier, paymentProof: proof, inputs },
      storage, payments, clock
    );

    expect(res1.jobId).toBe(res2.jobId);
    expect(res2.replayed).toBe(true);
  });

  it('4. duplicate funded retry with conflicting payload throws a conflict error', async () => {
    const inputs = { x: 1 };
    const inputHash = hashInputs(jobType, inputs);
    const intent = await getOrCreatePaymentIntent({
      idempotencyKey: 'id-1',
      buyerKey: 'u1',
      jobType,
      inputHash,
      price: { amount: '1000', currency: 'USDC' },
      payload: inputs
    }, storage, payments, clock);

    const proof = JSON.stringify({
      paymentIdentifier: intent.paymentRequirement.paymentIdentifier,
      signature: 'sig'
    });

    await admitFundedJob(
      { paymentIntentId: intent.paymentIntentId, paymentIdentifier: intent.paymentRequirement.paymentIdentifier, paymentProof: proof, inputs },
      storage, payments, clock
    );

    // Try with different inputs (though admitFundedJob uses the inputs provided in command to check against intent's hash)
    // Wait, in my admitFundedJob implementation, I check `currentInputHash === intent.inputHash`.
    // So if I pass inputs that hash to something else, it should fail.
    await expect(admitFundedJob(
      { paymentIntentId: intent.paymentIntentId, paymentIdentifier: intent.paymentRequirement.paymentIdentifier, paymentProof: proof, inputs: { x: 2 } },
      storage, payments, clock
    )).rejects.toThrow('Replay conflict');
  });

  it('5. successful completion stores one canonical result', async () => {
    const inputs = {};
    const inputHash = hashInputs(jobType, inputs);
    const intent = await getOrCreatePaymentIntent({
      idempotencyKey: 'id-1',
      buyerKey: 'u1',
      jobType,
      inputHash,
      price: { amount: '1000', currency: 'USDC' },
      payload: inputs
    }, storage, payments, clock);

    const proof = JSON.stringify({ paymentIdentifier: intent.paymentRequirement.paymentIdentifier, signature: 'sig' });
    const { jobId } = await admitFundedJob({ paymentIntentId: intent.paymentIntentId, paymentIdentifier: intent.paymentRequirement.paymentIdentifier, paymentProof: proof, inputs }, storage, payments, clock);
    
    const executionId = createExecutionId(randomUUID());
    await storage.saveAttempt({ id: executionId, jobId, status: 'DISPATCHED' as any, startedAt: clock.now() });

    await handleWorkerCallback(
      { jobId, executionId, status: 'SUCCESS', output: { result: 'first' } },
      storage, payments, clock
    );

    const jobResult = await storage.getResult(jobId);
    expect(jobResult?.output).toEqual({ result: 'first' });
  });

  it('6. timeout evaluator moves overdue jobs toward failure', async () => {
    const inputs = {};
    const inputHash = hashInputs(jobType, inputs);
    const intent = await getOrCreatePaymentIntent({
      idempotencyKey: 'id-1',
      buyerKey: 'u1',
      jobType,
      inputHash,
      price: { amount: '1000', currency: 'USDC' },
      payload: inputs
    }, storage, payments, clock);

    const proof = JSON.stringify({ paymentIdentifier: intent.paymentRequirement.paymentIdentifier, signature: 'sig' });
    const { jobId } = await admitFundedJob({ paymentIntentId: intent.paymentIntentId, paymentIdentifier: intent.paymentRequirement.paymentIdentifier, paymentProof: proof, inputs }, storage, payments, clock);

    const futureClock = {
      now: () => new Date(clock.now().getTime() + 120 * 1000)
    };

    const count = await evaluateTimeouts(storage, payments, futureClock as any);
    expect(count).toBe(1);

    const job = await storage.getJob(jobId);
    expect(job?.status).toBe(JobStatus.FAILED);
  });

  it('7. audit events are emitted for key life cycle steps', async () => {
    const inputs = {};
    const inputHash = hashInputs(jobType, inputs);
    const intent = await getOrCreatePaymentIntent({
      idempotencyKey: 'id-1',
      buyerKey: 'u1',
      jobType,
      inputHash,
      price: { amount: '1000', currency: 'USDC' },
      payload: inputs
    }, storage, payments, clock);

    const proof = JSON.stringify({ paymentIdentifier: intent.paymentRequirement.paymentIdentifier, signature: 'sig' });
    await admitFundedJob({ paymentIntentId: intent.paymentIntentId, paymentIdentifier: intent.paymentRequirement.paymentIdentifier, paymentProof: proof, inputs }, storage, payments, clock);

    const logs: any[] = (storage as any).auditLogs;
    const actions = logs.map(l => l.action);
    expect(actions).toContain('PAYMENT_INTENT_CREATED');
    expect(actions).toContain('PAYMENT_VERIFIED');
    expect(actions).toContain('JOB_FUNDED');
  });
});
