import { ExecutionAttempt, Job, JobResult, JobTemplate, PaymentRecord, PaymentIntent, ResolutionRecord } from '../domain/models';
import { DomainEvent } from '../domain/events';
import { ExecutionId, JobId, JobTemplateId, PaymentId, PaymentIntentId, ResolutionId } from '../domain/ids';

export interface IStoragePort {
  // Templates
  getTemplate(id: JobTemplateId): Promise<JobTemplate | null>;
  listTemplates(): Promise<JobTemplate[]>;

  // Payment Intents
  savePaymentIntent(intent: PaymentIntent): Promise<void>;
  getPaymentIntent(id: PaymentIntentId): Promise<PaymentIntent | null>;
  findPaymentIntentByInputHash(templateId: JobTemplateId, inputHash: string): Promise<PaymentIntent | null>;

  // Payments
  savePayment(payment: PaymentRecord): Promise<void>;
  getPayment(id: PaymentId): Promise<PaymentRecord | null>;
  getPaymentByPaymentIntentId(paymentIntentId: PaymentIntentId): Promise<PaymentRecord | null>;
  getPaymentByPaymentIdentifier(paymentIdentifier: string): Promise<PaymentRecord | null>;
  
  /**
   * Enforces invariant 1: one paymentIdentifier admits at most one job
   */
  getJobByPaymentIdentifier(paymentIdentifier: string): Promise<Job | null>;

  // Jobs
  saveJob(job: Job): Promise<void>;
  getJob(id: JobId): Promise<Job | null>;
  getJobByPaymentIntentId(paymentIntentId: PaymentIntentId): Promise<Job | null>;
  listActiveJobs(): Promise<Job[]>;

  // Results (Invariant 4: result retrievable independently)
  saveResult(result: JobResult): Promise<void>;
  getResult(jobId: JobId): Promise<JobResult | null>;

  // Resolutions (Invariant 5: financial resolution queryable independently)
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

  // Audit (Invariant 6: log every action)
  saveAuditLog(entry: any): Promise<void>;

  /**
   * Atomic operation wrapper for job admission
   */
  withPaymentIdentifierLock<T>(
    paymentIdentifier: string,
    operation: () => Promise<T>
  ): Promise<T>;
}
