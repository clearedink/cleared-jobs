import { randomUUID } from 'crypto';
import { IStoragePort } from '../ports/storage';
import { IWorkerPort } from '../ports/workers';
import { IClockPort } from '../ports/clock';
import { IPaymentPort } from '../ports/payments';
import { JobId, createExecutionId, createResolutionId } from '../domain/ids';
import { AttemptStatus, EscrowState, JobStatus, ResolutionState } from '../domain/statuses';
import { ExecutionAttempt, JobResult, ResolutionRecord } from '../domain/models';
import { 
  StartJobCommand, 
  CompleteJobCommand, 
  FailJobCommand, 
  GetJobStatusQuery, 
  GetJobStatusResult, 
  GetJobResultQuery, 
  GetJobResultResult 
} from '../use-cases/jobs';

/**
 * Dispatch a job to a worker and record the initial attempt
 */
export async function dispatchJob(
  jobId: JobId,
  storage: IStoragePort,
  workers: IWorkerPort,
  clock: IClockPort
): Promise<void> {
  const job = await storage.getJob(jobId);
  if (!job) throw new Error(`Job ${jobId} not found`);

  const executionId = createExecutionId(randomUUID());
  
  const attempt: ExecutionAttempt = {
    id: executionId,
    jobId: job.id,
    status: AttemptStatus.QUEUED,
    startedAt: clock.now(),
  };

  await storage.saveAttempt(attempt);

  job.status = JobStatus.QUEUED;
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
    action: 'JOB_QUEUED',
    actor: 'SYSTEM',
    resourceType: 'JOB',
    resourceId: job.id,
    payload: { executionId },
    metadata: {},
  });
}

/**
 * Marks a job as running.
 */
export async function startJob(
  command: StartJobCommand,
  storage: IStoragePort,
  clock: IClockPort
): Promise<void> {
  // If executionId provided, use it. Otherwise find current from job.
  let attemptId = command.executionId;
  if (!attemptId) {
    const job = await storage.getJob(command.jobId);
    attemptId = job?.currentAttemptId;
  }

  if (!attemptId) return;

  const attempt = await storage.getAttempt(attemptId);
  if (!attempt) return;

  attempt.status = AttemptStatus.RUNNING;
  await storage.saveAttempt(attempt);

  const job = await storage.getJob(attempt.jobId);
  if (job && job.status === JobStatus.QUEUED) {
    job.status = JobStatus.RUNNING;
    job.updatedAt = clock.now();
    await storage.saveJob(job);
  }
}

/**
 * Successfully completes a job and releases payment.
 */
export async function completeJob(
  command: CompleteJobCommand,
  storage: IStoragePort,
  payments: IPaymentPort,
  clock: IClockPort
): Promise<void> {
  const job = await storage.getJob(command.jobId);
  if (!job) throw new Error('Job not found');

  // Invariant: canonical result must not be overwritten
  const existingResult = await storage.getResult(job.id);
  if (existingResult) {
    console.log(`Job ${job.id} already has a canonical result. Ignoring duplicate completion.`);
    return;
  }

  let attemptId = command.executionId || job.currentAttemptId;
  if (attemptId) {
    const attempt = await storage.getAttempt(attemptId);
    if (attempt) {
      attempt.status = AttemptStatus.SUCCEEDED;
      attempt.finishedAt = clock.now();
      await storage.saveAttempt(attempt);
    }
  }

  // 1. Update Job
  job.status = JobStatus.COMPLETED;
  job.updatedAt = clock.now();
  await storage.saveJob(job);

  // 2. Store Result
  const jobResult: JobResult = {
    jobId: job.id,
    output: command.output,
    completedAt: clock.now(),
  };
  await storage.saveResult(jobResult);

  // 3. Handle Escrow & Resolution
  const payment = await storage.getPaymentByPaymentIdentifier(job.paymentIdentifier);
  if (payment) {
    payment.escrowState = EscrowState.RELEASE_PENDING;
    payment.updatedAt = clock.now();
    await storage.savePayment(payment);

    const resolutionId = createResolutionId(randomUUID());
    const resolution: ResolutionRecord = {
      id: resolutionId,
      jobId: job.id,
      state: ResolutionState.SUCCESS,
      resolvedAt: clock.now(),
      resolutionMetadata: { ...command.metadata, source: 'JOB_LIFECYCLE_SUCCESS' },
    };
    await storage.saveResolution(resolution);
    job.resolutionId = resolutionId;
    await storage.saveJob(job);

    // Release money
    await payments.releaseEscrow(job.paymentIdentifier);
    payment.escrowState = EscrowState.RELEASED;
    await storage.savePayment(payment);
  }

  // 4. Audit & Domain Events
  await storage.saveAuditLog({
    id: randomUUID(),
    timestamp: clock.now(),
    action: 'JOB_COMPLETED',
    actor: 'SYSTEM',
    resourceType: 'JOB',
    resourceId: job.id,
    payload: { executionId: attemptId },
    metadata: command.metadata || {},
  });

  await storage.saveDomainEvent({
    id: randomUUID(),
    timestamp: clock.now(),
    type: 'JOB_COMPLETED',
    aggregateId: job.id,
    jobId: job.id,
  } as any);
}

/**
 * Marks a job as failed.
 */
export async function failJob(
  command: FailJobCommand,
  storage: IStoragePort,
  clock: IClockPort
): Promise<void> {
  const job = await storage.getJob(command.jobId);
  if (!job) throw new Error('Job not found');

  let attemptId = command.executionId || job.currentAttemptId;
  if (attemptId) {
    const attempt = await storage.getAttempt(attemptId);
    if (attempt) {
      attempt.status = AttemptStatus.FAILED;
      attempt.finishedAt = clock.now();
      attempt.error = command.error;
      await storage.saveAttempt(attempt);
    }
  }

  job.status = JobStatus.FAILED;
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
      state: ResolutionState.REFUND_PENDING,
      resolvedAt: clock.now(),
      resolutionMetadata: { error: command.error, ...command.metadata },
    };
    await storage.saveResolution(resolution);
    job.resolutionId = resolutionId;
    await storage.saveJob(job);
  }

  await storage.saveAuditLog({
    id: randomUUID(),
    timestamp: clock.now(),
    action: 'JOB_FAILED',
    actor: 'SYSTEM',
    resourceType: 'JOB',
    resourceId: job.id,
    payload: { error: command.error },
    metadata: command.metadata || {},
  });
}

/**
 * Retrieves the current status of a job.
 */
export async function getJobStatus(
  query: GetJobStatusQuery,
  storage: IStoragePort
): Promise<GetJobStatusResult> {
  const job = await storage.getJob(query.jobId);
  if (!job) {
    throw new Error(`Job ${query.jobId} not found`);
  }

  return {
    jobId: job.id,
    status: job.status,
  };
}

/**
 * Retrieves the result of a completed job.
 */
export async function getJobResult(
  query: GetJobResultQuery,
  storage: IStoragePort
): Promise<GetJobResultResult> {
  const result = await storage.getResult(query.jobId);
  return {
    jobId: query.jobId,
    result: result || undefined,
  };
}
