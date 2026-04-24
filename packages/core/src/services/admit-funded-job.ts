import { randomUUID } from 'crypto';
import { IStoragePort } from '../ports/storage';
import { IPaymentPort } from '../ports/payments';
import { IClockPort } from '../ports/clock';
import { AdmitFundedJobCommand, AdmitFundedJobResult } from '../use-cases/admit';
import { EscrowState, JobStatus, QuoteStatus } from '../domain/statuses';
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
  // 1. Load the quote and validate
  const quote = await storage.getQuote(command.quoteId);
  if (!quote) {
    throw new QuoteNotFoundError(command.quoteId);
  }

  if (quote.status === QuoteStatus.FUNDED) {
    // If quote is already funded, we might be in a replay scenario checked below
    // but just in case, we check status here too.
  } else if (quote.status !== QuoteStatus.OPEN) {
    throw new QuoteAlreadyFundedError(command.quoteId); // Or more generic status error
  }

  if (quote.expiresAt < clock.now()) {
    throw new QuoteExpiredError(command.quoteId);
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
      // Logic request matching: check if input hash matches
      const currentInputHash = hashInputs(existingJob.templateId, command.inputs);
      if (currentInputHash === quote.inputHash) {
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
      quoteId: quote.id,
      paymentIdentifier: command.paymentIdentifier,
      amount: quote.priceAmount,
      currency: quote.priceCurrency,
      escrowState: EscrowState.HELD,
      paymentRail: 'UNKNOWN', // Should be determined by payment adapter/verification
      metadata: {
        paymentProof: command.paymentProof,
        verifiedAt: clock.now().toISOString(),
      },
      createdAt: clock.now(),
      updatedAt: clock.now(),
    };

    // 6. Mark quote as funded
    quote.status = QuoteStatus.FUNDED;
    await storage.saveQuote(quote);

    // 7. Create funded job
    const template = await storage.getTemplate(quote.templateId);
    const deadlineAt = new Date(clock.now().getTime() + (template?.slaSeconds || 60) * 1000);
    
    const jobId = createJobId(randomUUID());
    const job: Job = {
      id: jobId,
      quoteId: quote.id,
      templateId: quote.templateId,
      status: JobStatus.FUNDED,
      inputs: quote.inputs,
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
      payload: { quoteId: quote.id },
      metadata: {},
    });

    // 9. Append Domain Event
    await storage.saveDomainEvent({
      id: randomUUID(),
      timestamp: clock.now(),
      type: 'JOB_ADMITTED',
      aggregateId: job.id,
      jobId: job.id,
      quoteId: quote.id,
    } as any);

    return {
      jobId: job.id,
      replayed: false,
    };
  });
}
