import { randomUUID } from 'crypto';
import { IStoragePort } from '../ports/storage';
import { IClockPort } from '../ports/clock';
import { JobRecord, JobResult } from '../domain/models';
import { 
  StartJobInput, 
  CompleteJobInput, 
  FailJobInput, 
} from '../use-cases/jobs';
import { InvalidJobTransitionError, JobNotFoundError } from '../lib/errors';

export async function startJob(
  jobId: string,
  input: StartJobInput | undefined,
  storage: IStoragePort,
  clock: IClockPort
): Promise<JobRecord> {
  const job = await storage.getJob(jobId as any);
  if (!job) throw new JobNotFoundError(jobId);

  // Status transitions
  // admitted/queued → running
  // running        → running
  // completed      → completed
  // failed         → failed
  // manual_review  → manual_review
  // refund_due     → refund_due

  if (['completed', 'failed', 'manual_review', 'refund_due'].includes(job.status)) {
    return job; // Return unchanged
  }

  job.status = 'running';
  job.startedAt = clock.now().toISOString();
  job.updatedAt = job.startedAt;
  
  if (input?.metadata) {
    job.metadata = { ...job.metadata, ...input.metadata };
  }

  await storage.saveJob(job);

  await storage.saveAuditLog({
    id: randomUUID(),
    timestamp: new Date(job.startedAt),
    action: 'JOB_STARTED',
    actor: input?.workerId || 'SYSTEM',
    resourceType: 'JOB',
    resourceId: job.jobId,
    payload: {},
    metadata: input?.metadata || {},
  });

  return job;
}

export async function completeJob(
  jobId: string,
  input: CompleteJobInput,
  storage: IStoragePort,
  clock: IClockPort
): Promise<JobRecord> {
  const job = await storage.getJob(jobId as any);
  if (!job) throw new JobNotFoundError(jobId);

  // running/admitted/queued → completed
  // completed              → completed
  // failed/manual_review   → unchanged unless explicitly force-resolved
  // refund_due             → unchanged unless explicitly force-resolved

  if (['failed', 'manual_review', 'refund_due'].includes(job.status)) {
    throw new InvalidJobTransitionError(jobId, job.status as any, 'completed' as any);
  }

  if (job.status === 'completed') {
    return job;
  }

  const now = clock.now().toISOString();

  job.status = 'completed';
  job.completedAt = now;
  job.updatedAt = now;
  
  if (input.metadata) {
    job.metadata = { ...job.metadata, ...input.metadata };
  }

  await storage.saveJob(job);

  const jobResult: JobResult = {
    jobId: job.jobId,
    result: input.result,
    resultType: input.resultType,
    createdAt: now,
  };
  await storage.putResultOnce(jobResult);

  await storage.saveAuditLog({
    id: randomUUID(),
    timestamp: new Date(now),
    action: 'JOB_COMPLETED',
    actor: 'SYSTEM',
    resourceType: 'JOB',
    resourceId: job.jobId,
    payload: {},
    metadata: input.metadata || {},
  });

  return job;
}

export async function failJob(
  jobId: string,
  input: FailJobInput,
  storage: IStoragePort,
  clock: IClockPort
): Promise<JobRecord> {
  const job = await storage.getJob(jobId as any);
  if (!job) throw new JobNotFoundError(jobId);

  const now = clock.now().toISOString();

  const statusMap: Record<string, string> = {
    'retryable': 'failed',
    'manual_review': 'manual_review',
    'refund_due': 'refund_due',
    'terminal_failed': 'failed'
  };

  job.status = statusMap[input.resolution] as any || 'failed';
  job.failedAt = now;
  job.updatedAt = now;
  job.failureReason = input.reason;
  job.failureResolution = input.resolution;
  
  if (input.metadata) {
    job.metadata = { ...job.metadata, ...input.metadata };
  }

  await storage.saveJob(job);

  await storage.saveAuditLog({
    id: randomUUID(),
    timestamp: new Date(now),
    action: 'JOB_FAILED',
    actor: 'SYSTEM',
    resourceType: 'JOB',
    resourceId: job.jobId,
    payload: { reason: input.reason, resolution: input.resolution, errorCode: input.errorCode },
    metadata: input.metadata || {},
  });

  return job;
}

export async function getJob(
  jobId: string,
  storage: IStoragePort
): Promise<JobRecord | null> {
  return storage.getJob(jobId as any);
}

export async function getResult(
  jobId: string,
  storage: IStoragePort
): Promise<JobResult | null> {
  return storage.getResult(jobId as any);
}
