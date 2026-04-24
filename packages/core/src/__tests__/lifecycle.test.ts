import { describe, it, expect, beforeEach, vi } from 'vitest';
import { randomUUID } from 'crypto';
import { 
  createQuote, 
  admitFundedJob, 
  handleWorkerCallback, 
  evaluateTimeouts,
  SystemClock,
  createJobTemplateId,
  QuoteId,
  JobStatus
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
  const templateId = createJobTemplateId('test-template');

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

  it('1. create quote returns quoteId, paymentIdentifier, and challenge', async () => {
    const result = await createQuote(
      {
        templateId,
        buyerId: 'user-1',
        inputs: { foo: 'bar' }
      },
      storage,
      payments,
      clock
    );

    expect(result.quoteId).toBeDefined();
    expect(result.paymentRequirement.paymentIdentifier).toContain('x402-pt-');
    expect(result.paymentRequirement.clientConfig.scheme).toBe('x402');
    expect(result.price.amount).toBe('1000');
  });

  it('2. funded admission creates exactly one job', async () => {
    const quote = await createQuote({ templateId, buyerId: 'u1', inputs: {} }, storage, payments, clock);
    
    const admission = await admitFundedJob(
      {
        quoteId: quote.quoteId,
        paymentIdentifier: quote.paymentRequirement.paymentIdentifier,
        paymentProof: JSON.stringify({
          paymentIdentifier: quote.paymentRequirement.paymentIdentifier,
          signature: 'mock-sig'
        }),
        inputs: {}
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
    const quote = await createQuote({ templateId, buyerId: 'u1', inputs: { x: 1 } }, storage, payments, clock);
    const proof = JSON.stringify({
      paymentIdentifier: quote.paymentRequirement.paymentIdentifier,
      signature: 'sig'
    });

    const res1 = await admitFundedJob(
      { quoteId: quote.quoteId, paymentIdentifier: quote.paymentRequirement.paymentIdentifier, paymentProof: proof, inputs: { x: 1 } },
      storage, payments, clock
    );

    const res2 = await admitFundedJob(
      { quoteId: quote.quoteId, paymentIdentifier: quote.paymentRequirement.paymentIdentifier, paymentProof: proof, inputs: { x: 1 } },
      storage, payments, clock
    );

    expect(res1.jobId).toBe(res2.jobId);
    expect(res2.replayed).toBe(true);
  });

  it('4. duplicate funded retry with conflicting payload throws a conflict error', async () => {
    const quote = await createQuote({ templateId, buyerId: 'u1', inputs: { x: 1 } }, storage, payments, clock);
    const proof = JSON.stringify({
      paymentIdentifier: quote.paymentRequirement.paymentIdentifier,
      signature: 'sig'
    });

    await admitFundedJob(
      { quoteId: quote.quoteId, paymentIdentifier: quote.paymentRequirement.paymentIdentifier, paymentProof: proof, inputs: { x: 1 } },
      storage, payments, clock
    );

    // Try with different inputs for the same paymentIdentifier
    await expect(admitFundedJob(
      { quoteId: quote.quoteId, paymentIdentifier: quote.paymentRequirement.paymentIdentifier, paymentProof: proof, inputs: { x: 2 } },
      storage, payments, clock
    )).rejects.toThrow('Replay conflict');
  });

  it('5/6. successful completion stores one canonical result and ignores late duplicates', async () => {
    const quote = await createQuote({ templateId, buyerId: 'u1', inputs: {} }, storage, payments, clock);
    const proof = JSON.stringify({ paymentIdentifier: quote.paymentRequirement.paymentIdentifier, signature: 'sig' });
    const { jobId } = await admitFundedJob({ quoteId: quote.quoteId, paymentIdentifier: quote.paymentRequirement.paymentIdentifier, paymentProof: proof, inputs: {} }, storage, payments, clock);
    
    // Create an attempt
    const executionId = createExecutionId(randomUUID());
    await storage.saveAttempt({ id: executionId, jobId, status: 'DISPATCHED' as any, startedAt: clock.now() });

    // 1st completion
    await handleWorkerCallback(
      { jobId, executionId, status: 'SUCCESS', output: { result: 'first' } },
      storage, payments, clock
    );

    const jobResult = await storage.getResult(jobId);
    expect(jobResult?.output).toEqual({ result: 'first' });

    // 2nd "late" completion (different executionId or same)
    const execId2 = createExecutionId(randomUUID());
    await storage.saveAttempt({ id: execId2, jobId, status: 'DISPATCHED' as any, startedAt: clock.now() });
    
    await handleWorkerCallback(
      { jobId, executionId: execId2, status: 'SUCCESS', output: { result: 'late' } },
      storage, payments, clock
    );

    // Should NOT have overwritten
    const finalResult = await storage.getResult(jobId);
    expect(finalResult?.output).toEqual({ result: 'first' });
  });

  it('7. timeout evaluator moves overdue jobs toward refund', async () => {
    const quote = await createQuote({ templateId, buyerId: 'u1', inputs: {} }, storage, payments, clock);
    const proof = JSON.stringify({ paymentIdentifier: quote.paymentRequirement.paymentIdentifier, signature: 'sig' });
    
    // Admit job
    const { jobId } = await admitFundedJob({ quoteId: quote.quoteId, paymentIdentifier: quote.paymentRequirement.paymentIdentifier, paymentProof: proof, inputs: {} }, storage, payments, clock);

    // Travel in time
    const futureClock = {
      now: () => new Date(clock.now().getTime() + 120 * 1000) // + 2 mins (SLA is 60s)
    };

    const count = await evaluateTimeouts(storage, payments, futureClock as any);
    expect(count).toBe(1);

    const job = await storage.getJob(jobId);
    expect(job?.status).toBe(JobStatus.FAILED);
  });

  it('8. audit events are emitted for key life cycle steps', async () => {
    const quote = await createQuote({ templateId, buyerId: 'u1', inputs: {} }, storage, payments, clock);
    const proof = JSON.stringify({ paymentIdentifier: quote.paymentRequirement.paymentIdentifier, signature: 'sig' });
    const { jobId } = await admitFundedJob({ quoteId: quote.quoteId, paymentIdentifier: quote.paymentRequirement.paymentIdentifier, paymentProof: proof, inputs: {} }, storage, payments, clock);

    // Check audit logs via a manual cast to access internal storage state for testing
    const logs: any[] = (storage as any).auditLogs;
    
    const actions = logs.map(l => l.action);
    expect(actions).toContain('QUOTE_CREATED');
    expect(actions).toContain('PAYMENT_VERIFIED');
    expect(actions).toContain('JOB_FUNDED');
  });
});
