import { randomUUID } from 'crypto';
import { IStoragePort } from '../ports/storage';
import { IWorkerPort, WorkerResult } from '../ports/workers';
import { IClockPort } from '../ports/clock';
import { IPaymentPort } from '../ports/payments';
import { JobId, createExecutionId, ExecutionId, createResolutionId } from '../domain/ids';
import { AttemptStatus, EscrowState, JobStatus, ResolutionState } from '../domain/statuses';
import { Job, ExecutionAttempt, JobResult, ResolutionRecord } from '../domain/models';

/**
 * Dispatch a job to a worker and record the attempt
 */
export async function dispatchJob(
  jobId: JobId,
  storage: IStoragePort,
  workers: IWorkerPort,
  clock: IClockPort
): Promise<void> {
  const job = await storage.getJob(jobId);
  if (!job) throw new Error('Job not found');

  const executionId = createExecutionId(randomUUID());
  
  const attempt: ExecutionAttempt = {
    id: executionId,
    jobId: job.id,
    status: AttemptStatus.DISPATCHED,
    startedAt: clock.now(),
  };

  await storage.saveAttempt(attempt);

  job.status = JobStatus.DISPATCHED;
  job.currentAttemptId = executionId;
  job.updatedAt = clock.now();
  await storage.saveJob(job);

  await workers.dispatch({
    jobId: job.id,
    executionId,
    templateId: job.templateId,
    inputs: job.inputs,
  });

  await storage.saveAuditLog({
    id: randomUUID(),
    timestamp: clock.now(),
    action: 'JOB_DISPATCHED',
    actor: 'SYSTEM',
    resourceType: 'JOB',
    resourceId: job.id,
    payload: { executionId },
    metadata: {},
  });
}

/**
 * Handle worker start callback
 */
export async function handleWorkerStart(
  executionId: ExecutionId,
  storage: IStoragePort,
  clock: IClockPort
): Promise<void> {
  const attempt = await storage.getAttempt(executionId);
  if (!attempt) return;

  attempt.status = AttemptStatus.RUNNING;
  await storage.saveAttempt(attempt);

  const job = await storage.getJob(attempt.jobId);
  if (job && job.status === JobStatus.DISPATCHED) {
    job.status = JobStatus.RUNNING;
    job.updatedAt = clock.now();
    await storage.saveJob(job);
  }
}

/**
 * Handle worker completion (success or failure)
 */
export async function handleWorkerCallback(
  result: WorkerResult,
  storage: IStoragePort,
  payments: IPaymentPort,
  clock: IClockPort
): Promise<void> {
  const attempt = await storage.getAttempt(result.executionId);
  if (!attempt) throw new Error('Attempt not found');

  // Load the job
  const job = await storage.getJob(result.jobId);
  if (!job) throw new Error('Job not found');

  // Invariant 4: canonical result must not be overwritten
  const existingResult = await storage.getResult(job.id);
  if (existingResult) {
    console.log(`Job ${job.id} already has a canonical result. Ignoring duplicate completion.`);
    return;
  }

  if (result.status === 'SUCCESS') {
    // 1. Update Attempt
    attempt.status = AttemptStatus.SUCCEEDED;
    attempt.finishedAt = clock.now();
    await storage.saveAttempt(attempt);

    // 2. Update Job
    job.status = JobStatus.COMPLETED;
    job.updatedAt = clock.now();
    await storage.saveJob(job);

    // 3. Store Result (Invariant 4)
    const jobResult: JobResult = {
      jobId: job.id,
      output: result.output,
      completedAt: clock.now(),
    };
    await storage.saveResult(jobResult);

    // 4. Handle Escrow & Resolution
    const payment = await storage.getPaymentByPaymentIdentifier(job.paymentIdentifier);
    if (payment) {
      payment.escrowState = EscrowState.RELEASE_PENDING;
      payment.updatedAt = clock.now();
      await storage.savePayment(payment);

      // Decoupled resolution
      const resolutionId = createResolutionId(randomUUID());
      const resolution: ResolutionRecord = {
        id: resolutionId,
        jobId: job.id,
        state: ResolutionState.SUCCESS,
        resolvedAt: clock.now(),
        resolutionMetadata: { source: 'WORKER_SUCCESS' },
      };
      await storage.saveResolution(resolution);
      job.resolutionId = resolutionId;
      await storage.saveJob(job);

      // Release money
      await payments.releaseEscrow(job.paymentIdentifier);
      payment.escrowState = EscrowState.RELEASED;
      await storage.savePayment(payment);
    }

    // 5. Audit & Domain Events
    await storage.saveAuditLog({
      id: randomUUID(),
      timestamp: clock.now(),
      action: 'RESULT_STORED',
      actor: 'WORKER',
      resourceType: 'JOB',
      resourceId: job.id,
      payload: { executionId: result.executionId },
      metadata: {},
    });

    await storage.saveAuditLog({
      id: randomUUID(),
      timestamp: clock.now(),
      action: 'JOB_COMPLETED',
      actor: 'SYSTEM',
      resourceType: 'JOB',
      resourceId: job.id,
      payload: {},
      metadata: {},
    });

    await storage.saveDomainEvent({
      id: randomUUID(),
      timestamp: clock.now(),
      type: 'JOB_COMPLETED',
      aggregateId: job.id,
      jobId: job.id,
    });

  } else {
    // FAILURE
    attempt.status = AttemptStatus.FAILED;
    attempt.finishedAt = clock.now();
    attempt.error = result.error;
    await storage.saveAttempt(attempt);

    job.status = JobStatus.FAILED; // or RESOLUTION_REQUIRED depending on retry policy
    job.updatedAt = clock.now();
    await storage.saveJob(job);

    const payment = await storage.getPaymentByPaymentIdentifier(job.paymentIdentifier);
    if (payment) {
      payment.escrowState = EscrowState.REFUND_PENDING;
      payment.updatedAt = clock.now();
      await storage.savePayment(payment);

      const resolutionId = createResolutionId(randomUUID());
      const resolution: ResolutionRecord = {
        id: resolutionId,
        jobId: job.id,
        state: ResolutionState.REFUND_PENDING, // or MANUAL_REVIEW
        resolvedAt: clock.now(),
        resolutionMetadata: { error: result.error },
      };
      await storage.saveResolution(resolution);
      job.resolutionId = resolutionId;
      await storage.saveJob(job);
    }

    await storage.saveAuditLog({
      id: randomUUID(),
      timestamp: clock.now(),
      action: 'JOB_FAILED',
      actor: 'WORKER',
      resourceType: 'JOB',
      resourceId: job.id,
      payload: { error: result.error },
      metadata: {},
    });
  }
}
