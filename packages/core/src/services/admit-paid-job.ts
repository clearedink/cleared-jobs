import { randomUUID } from 'crypto';
import { IStoragePort } from '../ports/storage';
import { IClockPort } from '../ports/clock';
import { AdmitPaidJobCommand, AdmitPaidJobResult } from '../use-cases/admit';
import { EscrowState, JobStatus, JobIntentStatus } from '../domain/statuses';
import { createJobId, createPaymentId } from '../domain/ids';
import { hashInputs } from '../lib/hash-input';
import {
  JobIntentAlreadyFundedError,
  JobIntentExpiredError,
  JobIntentNotFoundError,
  ReplayConflictError,
} from '../lib/errors';
import { Job, PaymentRecord } from '../domain/models';

export async function admitPaidJob(
  command: AdmitPaidJobCommand,
  storage: IStoragePort,
  clock: IClockPort
): Promise<AdmitPaidJobResult> {
  const intent = await storage.getJobIntent(command.jobIntentId);
  if (!intent) {
    throw new JobIntentNotFoundError(command.jobIntentId);
  }

  if (intent.status === JobIntentStatus.FUNDED) {
    // Already funded
  } else if (intent.status !== JobIntentStatus.OPEN) {
    throw new JobIntentAlreadyFundedError(command.jobIntentId);
  }

  if (intent.expiresAt < clock.now()) {
    throw new JobIntentExpiredError(command.jobIntentId);
  }

  return await storage.withPaymentIdentifierLock(command.paymentIdentifier, async () => {
    const existingJob = await storage.getJobByPaymentIdentifier(command.paymentIdentifier);

    if (existingJob) {
      const currentInputHash = hashInputs(existingJob.templateId, command.inputs);
      if (currentInputHash === intent.inputHash) {
        return {
          jobId: existingJob.id,
          replayed: true,
        };
      } else {
        throw new ReplayConflictError(command.paymentIdentifier);
      }
    }

    const paymentRecord: PaymentRecord = {
      id: createPaymentId(randomUUID()),
      jobIntentId: intent.id,
      paymentIdentifier: command.paymentIdentifier,
      amount: command.amount,
      currency: command.currency,
      escrowState: EscrowState.HELD,
      paymentRail: 'UNKNOWN',
      metadata: {
        ...(command.paymentMetadata || {}),
        verifiedAt: clock.now().toISOString(),
      },
      createdAt: clock.now(),
      updatedAt: clock.now(),
    };

    intent.status = JobIntentStatus.FUNDED;
    await storage.saveJobIntent(intent);

    const template = await storage.getTemplate(intent.templateId);
    const deadlineAt = new Date(clock.now().getTime() + (template?.slaSeconds || 60) * 1000);
    
    const jobId = createJobId(randomUUID());
    const job: Job = {
      id: jobId,
      jobIntentId: intent.id,
      templateId: intent.templateId,
      status: JobStatus.ADMITTED,
      inputs: intent.inputs,
      paymentIdentifier: command.paymentIdentifier,
      deadlineAt,
      createdAt: clock.now(),
      updatedAt: clock.now(),
    };

    paymentRecord.jobId = jobId;

    await storage.savePayment(paymentRecord);
    await storage.saveJob(job);

    await storage.saveAuditLog({
      id: randomUUID(),
      timestamp: clock.now(),
      action: 'PAYMENT_ADMITTED',
      actor: 'SYSTEM',
      resourceType: 'PAYMENT',
      resourceId: paymentRecord.id,
      payload: { paymentIdentifier: command.paymentIdentifier },
      metadata: {},
    });

    await storage.saveAuditLog({
      id: randomUUID(),
      timestamp: clock.now(),
      action: 'JOB_ADMITTED',
      actor: 'SYSTEM',
      resourceType: 'JOB',
      resourceId: job.id,
      payload: { jobIntentId: intent.id },
      metadata: {},
    });

    return {
      jobId: job.id,
      replayed: false,
    };
  });
}
