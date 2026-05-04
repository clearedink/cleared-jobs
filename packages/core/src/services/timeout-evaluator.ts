import { randomUUID } from 'crypto';
import { IStoragePort } from '../ports/storage';
import { IClockPort } from '../ports/clock';
import { EscrowState, JobStatus, ResolutionState } from '../domain/statuses';
import { createResolutionId } from '../domain/ids';
import { ResolutionRecord } from '../domain/models';

/**
 * Scans for jobs that have exceeded their deadline without a terminal result.
 */
export async function evaluateTimeouts(
  storage: IStoragePort,
  clock: IClockPort
): Promise<number> {
  const activeJobs = await storage.listActiveJobs();
  const now = clock.now();
  let timedOutCount = 0;

  for (const job of activeJobs) {
    if (job.deadlineAt < now) {
      console.log(`[TimeoutEvaluator] Job ${job.id} timed out. Policy transition...`);
      
      // 1. Transition Job Status to REFUND_DUE
      job.status = JobStatus.REFUND_DUE;
      job.updatedAt = now;
      await storage.saveJob(job);

      // 2. Transition Financial State to REFUND_PENDING
      const payment = await storage.getPaymentByPaymentIdentifier(job.paymentIdentifier);
      if (payment) {
        payment.escrowState = EscrowState.REFUND_PENDING;
        payment.updatedAt = now;
        await storage.savePayment(payment);

        // 3. Create Resolution Record
        const resolutionId = createResolutionId(randomUUID());
        const resolution: ResolutionRecord = {
          id: resolutionId,
          jobId: job.id,
          state: ResolutionState.REFUND_PENDING,
          resolvedAt: now,
          resolutionMetadata: { reason: 'TIMEOUT' }
        };
        await storage.saveResolution(resolution);
        job.resolutionId = resolutionId;
        await storage.saveJob(job);
        
        // Note: Actual rail-level refundEscrow happens externally by monitoring REFUND_PENDING
      }

      // 4. Log Events
      await storage.saveAuditLog({
        id: randomUUID(),
        timestamp: now,
        action: 'JOB_TIMED_OUT',
        actor: 'SYSTEM',
        resourceType: 'JOB',
        resourceId: job.id,
        payload: { reason: 'TIMEOUT' },
        metadata: {}
      });

      timedOutCount++;
    }
  }

  return timedOutCount;
}
