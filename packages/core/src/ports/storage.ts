import { ExecutionAttempt, JobRecord, JobResult, JobTemplate, JobIntentRecord, ResolutionRecord } from '../domain/models';
import { DomainEvent } from '../domain/events';
import { ExecutionId, JobId, JobTemplateId, JobIntentId, ResolutionId } from '../domain/ids';

export interface IStoragePort {
  // Templates
  getTemplate(id: JobTemplateId): Promise<JobTemplate | null>;
  getTemplateByJobType(jobType: string): Promise<JobTemplate | null>;
  seedTemplates(templates: JobTemplate[]): Promise<void>;
  listTemplates(): Promise<JobTemplate[]>;

  // Job Intents
  saveJobIntent(intent: JobIntentRecord): Promise<void>;
  getJobIntent(id: JobIntentId): Promise<JobIntentRecord | null>;
  findJobIntentByIdempotencyKey(buyerKey: string, idempotencyKey: string): Promise<JobIntentRecord | null>;

  // Jobs
  saveJob(job: JobRecord): Promise<void>;
  getJob(id: JobId): Promise<JobRecord | null>;
  getJobByJobIntentId(jobIntentId: JobIntentId): Promise<JobRecord | null>;
  getJobByPaymentId(network: string, paymentId: string): Promise<JobRecord | null>;
  listActiveJobs(): Promise<JobRecord[]>;

  // Results
  saveResult(result: JobResult): Promise<void>;
  getResult(jobId: JobId): Promise<JobResult | null>;

  // Resolutions
  saveResolution(resolution: ResolutionRecord): Promise<void>;
  getResolution(id: ResolutionId): Promise<ResolutionRecord | null>;
  getResolutionByJobId(jobId: JobId): Promise<ResolutionRecord | null>;

  // Attempts
  saveAttempt(attempt: ExecutionAttempt): Promise<void>;
  getAttempt(id: ExecutionId): Promise<ExecutionAttempt | null>;
  listAttemptsByJobId(jobId: JobId): Promise<ExecutionAttempt[]>;

  // Events
  saveDomainEvent(event: DomainEvent): Promise<void>;
  listDomainEventsByAggregateId(aggregateId: string): Promise<DomainEvent[]>;

  // Audit
  saveAuditLog(entry: any): Promise<void>;

  /**
   * Atomic operation wrapper for job admission
   */
  withPaymentIdentifierLock<T>(
    paymentIdentifier: string,
    operation: () => Promise<T>
  ): Promise<T>;
}
