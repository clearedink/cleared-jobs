import { randomUUID } from 'crypto';
import { IStoragePort } from '../ports/storage';
import { IClockPort } from '../ports/clock';
import { IPaymentPort } from '../ports/payments';
import { JobId, createResolutionId } from '../domain/ids';
import { EscrowState, JobStatus, ResolutionState } from '../domain/statuses';
import { ResolutionRecord } from '../domain/models';

/**
 * Manually trigger a refund for a job.
 */
export async function operatorMarkRefund(
  jobId: JobId,
  actor: string,
  reason: string,
  storage: IStoragePort,
  payments: IPaymentPort,
  clock: IClockPort
) {
  const job = await storage.getJob(jobId);
  if (!job) throw new Error('Job not found');

  const payment = await storage.getPaymentByPaymentIdentifier(job.paymentIdentifier);
  if (!payment) throw new Error('Payment not found');

  payment.escrowState = EscrowState.REFUND_PENDING;
  payment.updatedAt = clock.now();
  await storage.savePayment(payment);

  await storage.saveAuditLog({
    id: randomUUID(),
    timestamp: clock.now(),
    action: 'OPERATOR_OVERRIDE_APPLIED',
    actor,
    resourceType: 'JOB',
    resourceId: jobId,
    payload: { action: 'MARK_REFUND', reason },
    metadata: {}
  });

  // Physically trigger refund
  await payments.refundEscrow(job.paymentIdentifier);
  payment.escrowState = EscrowState.REFUNDED;
  await storage.savePayment(payment);

  await storage.saveAuditLog({
    id: randomUUID(),
    timestamp: clock.now(),
    action: 'REFUND_COMPLETED',
    actor: 'SYSTEM',
    resourceType: 'PAYMENT',
    resourceId: job.paymentIdentifier,
    payload: { reason },
    metadata: {}
  });
}

/**
 * Elevate a job to manual review.
 */
export async function operatorMarkManualReview(
  jobId: JobId,
  actor: string,
  reason: string,
  storage: IStoragePort,
  clock: IClockPort
) {
  const job = await storage.getJob(jobId);
  if (!job) throw new Error('Job not found');

  job.status = JobStatus.RESOLUTION_REQUIRED;
  job.updatedAt = clock.now();
  await storage.saveJob(job);

  const resolutionId = createResolutionId(randomUUID());
  const resolution: ResolutionRecord = {
    id: resolutionId,
    jobId: job.id,
    state: ResolutionState.MANUAL_REVIEW,
    resolvedAt: clock.now(),
    resolutionMetadata: { actor, reason }
  };
  await storage.saveResolution(resolution);
  job.resolutionId = resolutionId;
  await storage.saveJob(job);

  await storage.saveAuditLog({
    id: randomUUID(),
    timestamp: clock.now(),
    action: 'JOB_MANUAL_REVIEW',
    actor,
    resourceType: 'JOB',
    resourceId: jobId,
    payload: { reason },
    metadata: {}
  });
}
