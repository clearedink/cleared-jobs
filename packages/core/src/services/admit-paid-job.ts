import { randomUUID } from 'crypto';
import { IStoragePort } from '../ports/storage';
import { IClockPort } from '../ports/clock';
import { AdmitPaidJobInput, AdmitPaidJobResult } from '../use-cases/admit';
import { createJobId } from '../domain/ids';
import { JobRecord } from '../domain/models';
import {
  JobIntentExpiredError,
  JobIntentNotFoundError,
  PaymentAlreadyAdmittedError,
} from '../lib/errors';

export async function admitPaidJob(
  input: AdmitPaidJobInput,
  storage: IStoragePort,
  clock: IClockPort
): Promise<AdmitPaidJobResult> {
  const now = clock.now().toISOString();

  if (input.intentId) {
    const intent = await storage.getJobIntent(input.intentId as any);
    if (!intent) {
      throw new JobIntentNotFoundError(input.intentId);
    }
    if (intent.expiresAt && new Date(intent.expiresAt) < clock.now()) {
      throw new JobIntentExpiredError(input.intentId);
    }
    
    intent.status = 'paid';
    intent.paymentId = input.paymentId;
    await storage.saveJobIntent(intent);
  }

  return await storage.withPaymentIdentifierLock(input.paymentId, async () => {
    const existingJob = await storage.getJobByPaymentId(input.network, input.paymentId);

    if (existingJob) {
      if (existingJob.inputHash !== input.inputHash) {
        throw new PaymentAlreadyAdmittedError(input.paymentId, existingJob.jobId);
      }
      return {
        type: 'already_admitted',
        jobId: existingJob.jobId,
        status: existingJob.status,
        paymentId: existingJob.paymentId!,
        intentId: existingJob.intentId,
      };
    }

    const jobId = createJobId(randomUUID());
    const job: JobRecord = {
      jobId,
      intentId: input.intentId,
      paymentId: input.paymentId,
      payer: input.payer,
      payTo: input.payTo,
      amount: input.amount,
      currency: input.currency,
      network: input.network,
      txHash: input.txHash,
      jobType: input.jobType,
      status: 'admitted',
      inputHash: input.inputHash,
      payload: input.payload,
      createdAt: now,
      updatedAt: now,
      metadata: input.metadata,
    };

    await storage.saveJob(job);

    if (input.enqueue) {
      try {
        await input.enqueue({
          jobId: job.jobId,
          jobType: job.jobType,
          payload: job.payload,
        });
      } catch (err) {
        console.error(`Failed to enqueue job ${job.jobId}`, err);
        // Do not fail admission if enqueue fails (outbox pattern should be used in prod)
      }
    }

    await storage.saveAuditLog({
      id: randomUUID(),
      timestamp: new Date(now),
      action: 'JOB_ADMITTED',
      actor: 'SYSTEM',
      resourceType: 'JOB',
      resourceId: jobId,
      payload: { paymentId: input.paymentId },
      metadata: {},
    });

    return {
      type: 'admitted',
      jobId,
      status: job.status,
      paymentId: input.paymentId,
      intentId: input.intentId,
    };
  });
}
