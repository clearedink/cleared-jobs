import { randomUUID } from 'crypto';
import { IStoragePort } from '../ports/storage';
import { IPaymentPort } from '../ports/payments';
import { IClockPort } from '../ports/clock';
import { AdmitFundedJobCommand, AdmitFundedJobResult } from '../use-cases/admit';
import { EscrowState, JobStatus, PaymentIntentStatus } from '../domain/statuses';
import { createJobId, createPaymentId } from '../domain/ids';
import { hashInputs } from '../lib/hash-input';
import {
  InvalidPaymentProofError,
  PaymentIdentifierMismatchError,
  QuoteAlreadyFundedError,
  QuoteExpiredError,
  QuoteNotFoundError,
  ReplayConflictError,
} from '../lib/errors';
import { Job, PaymentRecord } from '../domain/models';

export async function admitFundedJob(
  command: AdmitFundedJobCommand,
  storage: IStoragePort,
  payments: IPaymentPort,
  clock: IClockPort
): Promise<AdmitFundedJobResult> {
  // 1. Load the intent and validate
  const intent = await storage.getPaymentIntent(command.paymentIntentId);
  if (!intent) {
    throw new QuoteNotFoundError(command.paymentIntentId as any); // TODO: Rename error
  }

  if (intent.status === PaymentIntentStatus.FUNDED) {
    // Already funded
  } else if (intent.status !== PaymentIntentStatus.OPEN) {
    throw new QuoteAlreadyFundedError(command.paymentIntentId as any);
  }

  if (intent.expiresAt < clock.now()) {
    throw new QuoteExpiredError(command.paymentIntentId as any);
  }

  // 2. Verify payment proof through payment adapter
  const verification = await payments.verifyProof(command.paymentProof);
  if (!verification.verified) {
    throw new InvalidPaymentProofError(command.paymentIdentifier);
  }

  if (verification.paymentIdentifier !== command.paymentIdentifier) {
    throw new PaymentIdentifierMismatchError(command.paymentIdentifier, verification.paymentIdentifier);
  }

  // 3. Use storage lock for atomicity
  return await storage.withPaymentIdentifierLock(command.paymentIdentifier, async () => {
    // 4. Check if a job already exists for this paymentIdentifier (Idempotency)
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

    // 5. Create immutable payment record
    const paymentRecord: PaymentRecord = {
      id: createPaymentId(randomUUID()),
      paymentIntentId: intent.id,
      paymentIdentifier: command.paymentIdentifier,
      amount: intent.priceAmount,
      currency: intent.priceCurrency,
      escrowState: EscrowState.HELD,
      paymentRail: 'UNKNOWN',
      metadata: {
        paymentProof: command.paymentProof,
        verifiedAt: clock.now().toISOString(),
      },
      createdAt: clock.now(),
      updatedAt: clock.now(),
    };

    // 6. Mark intent as funded
    intent.status = PaymentIntentStatus.FUNDED;
    await storage.savePaymentIntent(intent);

    // 7. Create funded job
    const template = await storage.getTemplate(intent.templateId);
    const deadlineAt = new Date(clock.now().getTime() + (template?.slaSeconds || 60) * 1000);
    
    const jobId = createJobId(randomUUID());
    const job: Job = {
      id: jobId,
      paymentIntentId: intent.id,
      templateId: intent.templateId,
      status: JobStatus.FUNDED,
      inputs: intent.inputs,
      paymentIdentifier: command.paymentIdentifier,
      deadlineAt,
      createdAt: clock.now(),
      updatedAt: clock.now(),
    };

    paymentRecord.jobId = jobId;

    await storage.savePayment(paymentRecord);
    await storage.saveJob(job);

    // 8. Append Audit Events
    await storage.saveAuditLog({
      id: randomUUID(),
      timestamp: clock.now(),
      action: 'PAYMENT_VERIFIED',
      actor: 'SYSTEM',
      resourceType: 'PAYMENT',
      resourceId: paymentRecord.id,
      payload: { paymentIdentifier: command.paymentIdentifier },
      metadata: {},
    });

    await storage.saveAuditLog({
      id: randomUUID(),
      timestamp: clock.now(),
      action: 'JOB_FUNDED',
      actor: 'SYSTEM',
      resourceType: 'JOB',
      resourceId: job.id,
      payload: { paymentIntentId: intent.id },
      metadata: {},
    });

    // 9. Append Domain Event
    await storage.saveDomainEvent({
      id: randomUUID(),
      timestamp: clock.now(),
      type: 'JOB_ADMITTED',
      aggregateId: job.id,
      jobId: job.id,
      paymentIntentId: intent.id,
    } as any);

    return {
      jobId: job.id,
      replayed: false,
    };
  });
}
