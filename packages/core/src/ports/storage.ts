import { Job, JobResult, JobTemplate, PaymentRecord, Quote } from '../domain/models';
import { JobId, JobTemplateId, PaymentId, QuoteId } from '../domain/ids';

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

  // Jobs
  saveJob(job: Job): Promise<void>;
  getJob(id: JobId): Promise<Job | null>;
  getJobByQuoteId(quoteId: QuoteId): Promise<Job | null>;

  // Results
  saveResult(result: JobResult): Promise<void>;
  getResult(jobId: JobId): Promise<JobResult | null>;
}
