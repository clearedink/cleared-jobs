import { JobRecord, JobResult, JobIntentRecord } from '../domain/models';
import { DomainEvent } from '../domain/events';
import { JobId, JobIntentId } from '../domain/ids';

export interface IStoragePort {
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
