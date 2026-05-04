import { describe, it, expect, beforeEach, vi } from 'vitest';
import { randomUUID } from 'crypto';
import { 
  getOrCreateJobIntent, 
  admitPaidJob, 
  handlePaidJobRequest,
  startJob,
  completeJob,
  failJob,
  evaluateTimeouts,
  SystemClock,
  createJobTemplateId,
  createExecutionId,
  JobIntentId,
  JobStatus,
  AttemptStatus,
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

  it('1. getOrCreateJobIntent returns jobIntentId and requirements', async () => {
    const inputs = { foo: 'bar' };
    const inputHash = hashInputs(jobType, inputs);
    
    // Simulate application layer generating requirement
    const requirement = await payments.createIntent({ 
      id: randomUUID(), 
      priceAmount: 1000n, 
      priceCurrency: 'USDC' 
    } as any);

    const result = await getOrCreateJobIntent(
      {
        idempotencyKey: 'id-1',
        buyerKey: 'user-1',
        jobType,
        inputHash,
        price: { amount: '1000', currency: 'USDC' },
        payload: inputs,
        paymentRequirement: {
          paymentIdentifier: requirement.paymentIdentifier,
          clientConfig: requirement.clientConfig
        }
      },
      storage,
      clock
    );

    expect(result.jobIntentId).toBeDefined();
    expect(result.paymentRequirement.paymentIdentifier).toContain('x402-pt-');
  });

  it('2. handlePaidJobRequest orchestrates full flow', async () => {
    const inputs = { foo: 'bar' };
    const inputHash = hashInputs(jobType, inputs);
    const idempotencyKey = 'id-2';

    // Simulate application layer generating requirement
    const requirement = await payments.createIntent({ 
      id: idempotencyKey, 
      priceAmount: 1000n, 
      priceCurrency: 'USDC' 
    } as any);

    // Step A: Initial request (no verified payment)
    const res1 = await handlePaidJobRequest(
      {
        idempotencyKey,
        buyerKey: 'user-1',
        jobType,
        inputHash,
        price: { amount: '1000', currency: 'USDC' },
        payload: inputs,
        paymentRequirement: {
          paymentIdentifier: requirement.paymentIdentifier,
          clientConfig: requirement.clientConfig
        }
      },
      storage,
      clock
    );

    expect(res1.type).toBe('payment_required');
    if (res1.type === 'payment_required') {
      expect(res1.jobIntentId).toBeDefined();
      expect(res1.paymentRequirement.paymentIdentifier).toBeDefined();
    }

    // Step B: Retry with payment
    if (res1.type === 'payment_required') {
      const proof = JSON.stringify({
        paymentIdentifier: res1.paymentRequirement.paymentIdentifier,
        signature: 'sig'
      });
      
      // Simulate application layer verifying payment
      const verification = await payments.verifyProof(proof);
      expect(verification.verified).toBe(true);

      const res2 = await handlePaidJobRequest(
        {
          idempotencyKey,
          buyerKey: 'user-1',
          jobType,
          inputHash,
          price: { amount: '1000', currency: 'USDC' },
          payload: inputs,
          paymentRequirement: res1.paymentRequirement,
          verifiedPayment: {
            paymentIdentifier: verification.paymentIdentifier,
            amount: verification.amount,
            currency: verification.currency
          },
          enqueue: async ({ jobId }) => {
            await mockWorkerPort.dispatch({ jobId });
          }
        },
        storage,
        clock
      );

      expect(res2.type).toBe('accepted');
      if (res2.type === 'accepted') {
        expect(res2.jobId).toBeDefined();
        expect(mockWorkerPort.dispatch).toHaveBeenCalledWith({ jobId: res2.jobId });
      }

      // Step C: Replay
      const res3 = await handlePaidJobRequest(
        {
          idempotencyKey,
          buyerKey: 'user-1',
          jobType,
          inputHash,
          price: { amount: '1000', currency: 'USDC' },
          payload: inputs,
          paymentRequirement: res1.paymentRequirement,
          verifiedPayment: {
            paymentIdentifier: verification.paymentIdentifier,
            amount: verification.amount,
            currency: verification.currency
          }
        },
        storage,
        clock
      );
      expect(res3.type).toBe('already_accepted');
    }
  });

  it('3. successful completion stores one canonical result', async () => {
    const inputs = {};
    const inputHash = hashInputs(jobType, inputs);
    
    const requirement = await payments.createIntent({ id: randomUUID(), priceAmount: 1000n, priceCurrency: 'USDC' } as any);
    
    const intent = await getOrCreateJobIntent({
      idempotencyKey: 'id-1',
      buyerKey: 'u1',
      jobType,
      inputHash,
      price: { amount: '1000', currency: 'USDC' },
      payload: inputs,
      paymentRequirement: {
        paymentIdentifier: requirement.paymentIdentifier,
        clientConfig: requirement.clientConfig
      }
    }, storage, clock);

    const proof = JSON.stringify({ paymentIdentifier: intent.paymentRequirement.paymentIdentifier, signature: 'sig' });
    const verification = await payments.verifyProof(proof);

    const { jobId } = await admitPaidJob({ 
      jobIntentId: intent.jobIntentId, 
      paymentIdentifier: verification.paymentIdentifier, 
      amount: verification.amount,
      currency: verification.currency,
      inputs 
    }, storage, clock);
    
    const executionId = createExecutionId(randomUUID());
    await storage.saveAttempt({ id: executionId, jobId, status: AttemptStatus.QUEUED, startedAt: clock.now() });

    await completeJob(
      { jobId, executionId, output: { result: 'first' } },
      storage, clock
    );

    const jobResult = await storage.getResult(jobId);
    expect(jobResult?.output).toEqual({ result: 'first' });
  });

  it('4. timeout evaluator moves overdue jobs toward refund', async () => {
    const inputs = {};
    const inputHash = hashInputs(jobType, inputs);
    const requirement = await payments.createIntent({ id: randomUUID(), priceAmount: 1000n, priceCurrency: 'USDC' } as any);

    const intent = await getOrCreateJobIntent({
      idempotencyKey: 'id-1',
      buyerKey: 'u1',
      jobType,
      inputHash,
      price: { amount: '1000', currency: 'USDC' },
      payload: inputs,
      paymentRequirement: {
        paymentIdentifier: requirement.paymentIdentifier,
        clientConfig: requirement.clientConfig
      }
    }, storage, clock);

    const proof = JSON.stringify({ paymentIdentifier: intent.paymentRequirement.paymentIdentifier, signature: 'sig' });
    const verification = await payments.verifyProof(proof);

    await admitPaidJob({ 
      jobIntentId: intent.jobIntentId, 
      paymentIdentifier: verification.paymentIdentifier, 
      amount: verification.amount,
      currency: verification.currency,
      inputs 
    }, storage, clock);

    const futureClock = {
      now: () => new Date(clock.now().getTime() + 120 * 1000)
    };

    const count = await evaluateTimeouts(storage, futureClock as any);
    expect(count).toBe(1);

    const job = await storage.getJobByPaymentIdentifier(verification.paymentIdentifier);
    expect(job?.status).toBe(JobStatus.REFUND_DUE);
  });

  it('5. audit events are emitted for key life cycle steps', async () => {
    const inputs = {};
    const inputHash = hashInputs(jobType, inputs);
    const requirement = await payments.createIntent({ id: randomUUID(), priceAmount: 1000n, priceCurrency: 'USDC' } as any);

    const intent = await getOrCreateJobIntent({
      idempotencyKey: 'id-1',
      buyerKey: 'u1',
      jobType,
      inputHash,
      price: { amount: '1000', currency: 'USDC' },
      payload: inputs,
      paymentRequirement: {
        paymentIdentifier: requirement.paymentIdentifier,
        clientConfig: requirement.clientConfig
      }
    }, storage, clock);

    const proof = JSON.stringify({ paymentIdentifier: intent.paymentRequirement.paymentIdentifier, signature: 'sig' });
    const verification = await payments.verifyProof(proof);

    await admitPaidJob({ 
      jobIntentId: intent.jobIntentId, 
      paymentIdentifier: verification.paymentIdentifier, 
      amount: verification.amount,
      currency: verification.currency,
      inputs 
    }, storage, clock);

    const logs: any[] = (storage as any).auditLogs;
    const actions = logs.map(l => l.action);
    expect(actions).toContain('JOB_INTENT_CREATED');
    expect(actions).toContain('PAYMENT_ADMITTED');
    expect(actions).toContain('JOB_ADMITTED');
  });
});
