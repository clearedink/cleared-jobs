import { describe, it, expect, beforeEach, vi } from 'vitest';
import { randomUUID } from 'crypto';
import { 
  createCleared,
  SystemClock,
  createJobTemplateId,
  JobStatus,
  hashInputs
} from '../index';
import { MemoryStorage } from '../../../storage-memory/src/memory-storage';
import { MockX402Adapter } from '../../../payment-x402/src/mock-x402-adapter';

describe('Job Lifecycle via Cleared Client', () => {
  let storage: MemoryStorage;
  let payments: MockX402Adapter;
  let clock: SystemClock;
  let cleared: ReturnType<typeof createCleared>;
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

    cleared = createCleared({ storage, clock });

    // Seed a template
    await storage.seedTemplates([{
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

  it('1. getOrCreateJobIntent returns job intent record', async () => {
    const inputs = { foo: 'bar' };
    const inputHash = hashInputs(jobType, inputs);
    
    const result = await cleared.getOrCreateJobIntent({
      idempotencyKey: 'id-1',
      buyerKey: 'user-1',
      jobType,
      inputHash,
      price: { amount: '1000', currency: 'USDC', network: 'test' },
      payload: inputs,
    });

    expect(result.intentId).toBeDefined();
    expect(result.status).toBe('requires_payment');
  });

  it('2. handlePaidJobRequest orchestrates full flow', async () => {
    const inputs = { foo: 'bar' };
    const inputHash = hashInputs(jobType, inputs);
    const idempotencyKey = 'id-2';

    // Step A: Initial request (no verified payment)
    const res1 = await cleared.handlePaidJobRequest({
      idempotencyKey,
      buyerKey: 'user-1',
      jobType,
      inputHash,
      price: { amount: '1000', currency: 'USDC', network: 'test' },
      payload: inputs,
    });

    expect(res1.type).toBe('payment_required');
    if (res1.type === 'payment_required') {
      expect(res1.intentId).toBeDefined();
      
      // Step B: Retry with payment
      const paymentId = 'pay-' + randomUUID();
      const res2 = await cleared.handlePaidJobRequest({
        idempotencyKey,
        buyerKey: 'user-1',
        jobType,
        inputHash,
        price: { amount: '1000', currency: 'USDC', network: 'test' },
        payload: inputs,
        payment: {
          paymentId,
          payer: '0xBuyer',
          payTo: '0xTest',
          amount: '1000',
          currency: 'USDC',
          network: 'test'
        },
        enqueue: async ({ jobId }) => {
          // enqueue mock
        }
      });

      expect(res2.type).toBe('admitted');
      if (res2.type === 'admitted') {
        expect(res2.jobId).toBeDefined();
      }

      // Step C: Replay
      const res3 = await cleared.handlePaidJobRequest({
        idempotencyKey,
        buyerKey: 'user-1',
        jobType,
        inputHash,
        price: { amount: '1000', currency: 'USDC', network: 'test' },
        payload: inputs,
        payment: {
          paymentId,
          payer: '0xBuyer',
          payTo: '0xTest',
          amount: '1000',
          currency: 'USDC',
          network: 'test'
        }
      });
      expect(res3.type).toBe('already_admitted');
    }
  });

  it('3. successful completion stores one canonical result', async () => {
    const inputs = {};
    const inputHash = hashInputs(jobType, inputs);
    
    const intent = await cleared.getOrCreateJobIntent({
      idempotencyKey: 'id-3',
      buyerKey: 'u1',
      jobType,
      inputHash,
      price: { amount: '1000', currency: 'USDC', network: 'test' },
      payload: inputs,
    });

    const paymentId = 'pay-' + randomUUID();
    const admission = await cleared.admitPaidJob({ 
      intentId: intent.intentId, 
      paymentId,
      payer: '0xUser',
      amount: '1000',
      currency: 'USDC',
      network: 'test',
      jobType,
      inputHash,
      payload: inputs 
    });
    
    await cleared.startJob(admission.jobId);
    
    await cleared.completeJob(admission.jobId, {
      result: { ok: true }
    });

    const result = await cleared.getResult(admission.jobId);
    expect(result?.result).toEqual({ ok: true });
    
    const job = await cleared.getJob(admission.jobId);
    expect(job?.status).toBe('completed');
  });

  it('4. failure transitions and rules', async () => {
    const inputs = {};
    const inputHash = hashInputs(jobType, inputs);
    
    const intent = await cleared.getOrCreateJobIntent({
      idempotencyKey: 'id-4',
      buyerKey: 'u1',
      jobType,
      inputHash,
      price: { amount: '1000', currency: 'USDC', network: 'test' },
      payload: inputs,
    });

    const paymentId = 'pay-' + randomUUID();
    const admission = await cleared.admitPaidJob({ 
      intentId: intent.intentId, 
      paymentId,
      payer: '0xUser',
      amount: '1000',
      currency: 'USDC',
      network: 'test',
      jobType,
      inputHash,
      payload: inputs 
    });
    
    await cleared.startJob(admission.jobId);
    
    await cleared.failJob(admission.jobId, {
      reason: 'timeout',
      resolution: 'refund_due'
    });

    const job = await cleared.getJob(admission.jobId);
    expect(job?.status).toBe('refund_due');
    
    // completed shouldn't be allowed now
    await expect(cleared.completeJob(admission.jobId, { result: {} }))
      .rejects.toThrow('Invalid job transition');
  });
});
