import { Job, JobResult, JobTemplate, PaymentRecord, Quote, ResolutionRecord } from '../domain/models';
import { JobId, JobTemplateId, PaymentId, QuoteId, ResolutionId } from '../domain/ids';

export interface IStoragePort {
  // Templates
  getTemplate(id: JobTemplateId): Promise<JobTemplate | null>;
  listTemplates(): Promise<JobTemplate[]>;

  // Quotes
  saveQuote(quote: Quote): Promise<void>;
  getQuote(id: QuoteId): Promise<Quote | null>;
  findQuoteByInputHash(templateId: JobTemplateId, inputHash: string): Promise<Quote | null>;

  // Payments
  savePayment(payment: PaymentRecord): Promise<void>;
  getPayment(id: PaymentId): Promise<PaymentRecord | null>;
  getPaymentByQuoteId(quoteId: QuoteId): Promise<PaymentRecord | null>;
  
  /**
   * Enforces invariant 1: one paymentIdentifier admits at most one job
   */
  getJobByPaymentIdentifier(paymentIdentifier: string): Promise<Job | null>;

  // Jobs
  saveJob(job: Job): Promise<void>;
  getJob(id: JobId): Promise<Job | null>;
  getJobByQuoteId(quoteId: QuoteId): Promise<Job | null>;

  // Results (Invariant 4: result retrievable independently)
  saveResult(result: JobResult): Promise<void>;
  getResult(jobId: JobId): Promise<JobResult | null>;

  // Resolutions (Invariant 5: financial resolution queryable independently)
  saveResolution(resolution: ResolutionRecord): Promise<void>;
  getResolution(id: ResolutionId): Promise<ResolutionRecord | null>;
  getResolutionByJobId(jobId: JobId): Promise<ResolutionRecord | null>;

  // Audit (Invariant 6: log every action)
  saveAuditLog(entry: any): Promise<void>;
}
