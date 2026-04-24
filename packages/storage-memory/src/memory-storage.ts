import {
  ExecutionAttempt,
  ExecutionId,
  IStoragePort,
  Job,
  JobId,
  JobResult,
  JobTemplate,
  JobTemplateId,
  PaymentId,
  PaymentRecord,
  Quote,
  QuoteId,
  ResolutionId,
  ResolutionRecord,
  DomainEvent,
} from '@cleared/core';

export class MemoryStorage implements IStoragePort {
  private templates = new Map<JobTemplateId, JobTemplate>();
  private quotes = new Map<QuoteId, Quote>();
  private payments = new Map<PaymentId, PaymentRecord>();
  private jobs = new Map<JobId, Job>();
  private attempts = new Map<ExecutionId, ExecutionAttempt>();
  private results = new Map<JobId, JobResult>();
  private resolutions = new Map<ResolutionId, ResolutionRecord>();
  private domainEvents: DomainEvent[] = [];
  private auditLogs: any[] = [];

  // Simple admission lock for single-process local dev
  private admissionLocks = new Set<string>();

  async getTemplate(id: JobTemplateId): Promise<JobTemplate | null> {
    return this.templates.get(id) || null;
  }

  async listTemplates(): Promise<JobTemplate[]> {
    return Array.from(this.templates.values());
  }

  async saveQuote(quote: Quote): Promise<void> {
    this.quotes.set(quote.id, quote);
  }

  async getQuote(id: QuoteId): Promise<Quote | null> {
    return this.quotes.get(id) || null;
  }

  async findQuoteByInputHash(templateId: JobTemplateId, inputHash: string): Promise<Quote | null> {
    return Array.from(this.quotes.values()).find(
      q => q.templateId === templateId && q.inputHash === inputHash
    ) || null;
  }

  async savePayment(payment: PaymentRecord): Promise<void> {
    this.payments.set(payment.id, payment);
  }

  async getPayment(id: PaymentId): Promise<PaymentRecord | null> {
    return this.payments.get(id) || null;
  }

  async getPaymentByQuoteId(quoteId: QuoteId): Promise<PaymentRecord | null> {
    return Array.from(this.payments.values()).find(p => p.quoteId === quoteId) || null;
  }

  async getPaymentByPaymentIdentifier(paymentIdentifier: string): Promise<PaymentRecord | null> {
    return Array.from(this.payments.values()).find(p => p.paymentIdentifier === paymentIdentifier) || null;
  }

  async getJobByPaymentIdentifier(paymentIdentifier: string): Promise<Job | null> {
    return Array.from(this.jobs.values()).find(j => j.paymentIdentifier === paymentIdentifier) || null;
  }

  async saveJob(job: Job): Promise<void> {
    this.jobs.set(job.id, job);
  }

  async getJob(id: JobId): Promise<Job | null> {
    return this.jobs.get(id) || null;
  }

  async getJobByQuoteId(quoteId: QuoteId): Promise<Job | null> {
    return Array.from(this.jobs.values()).find(j => j.quoteId === quoteId) || null;
  }

  async saveResult(result: JobResult): Promise<void> {
    this.results.set(result.jobId, result);
  }

  async getResult(jobId: JobId): Promise<JobResult | null> {
    return this.results.get(jobId) || null;
  }

  async saveResolution(resolution: ResolutionRecord): Promise<void> {
    this.resolutions.set(resolution.id, resolution);
  }

  async getResolution(id: ResolutionId): Promise<ResolutionRecord | null> {
    return this.resolutions.get(id) || null;
  }

  async getResolutionByJobId(jobId: JobId): Promise<ResolutionRecord | null> {
    return Array.from(this.resolutions.values()).find(r => r.jobId === jobId) || null;
  }

  async saveAttempt(attempt: ExecutionAttempt): Promise<void> {
    this.attempts.set(attempt.id, attempt);
  }

  async getAttempt(id: ExecutionId): Promise<ExecutionAttempt | null> {
    return this.attempts.get(id) || null;
  }

  async listAttemptsByJobId(jobId: JobId): Promise<ExecutionAttempt[]> {
    return Array.from(this.attempts.values()).filter(a => a.jobId === jobId);
  }

  async saveDomainEvent(event: DomainEvent): Promise<void> {
    this.domainEvents.push(event);
  }

  async listDomainEventsByAggregateId(aggregateId: string): Promise<DomainEvent[]> {
    return this.domainEvents.filter(e => e.aggregateId === aggregateId);
  }

  async saveAuditLog(entry: any): Promise<void> {
    this.auditLogs.push(entry);
  }

  /**
   * Atomic operation wrapper for job admission
   */
  async withPaymentIdentifierLock<T>(
    paymentIdentifier: string,
    operation: () => Promise<T>
  ): Promise<T> {
    const acquired = await this.acquireAdmissionLock(paymentIdentifier);
    if (!acquired) {
      throw new Error('Could not acquire admission lock');
    }
    try {
      return await operation();
    } finally {
      await this.releaseAdmissionLock(paymentIdentifier);
    }
  }

  /**
   * Simple admission lock implementation for local dev
   */
  private async acquireAdmissionLock(paymentIdentifier: string): Promise<boolean> {
    if (this.admissionLocks.has(paymentIdentifier)) {
      return false;
    }
    this.admissionLocks.add(paymentIdentifier);
    return true;
  }

  async releaseAdmissionLock(paymentIdentifier: string): Promise<void> {
    this.admissionLocks.delete(paymentIdentifier);
  }

  // Pre-seed helper for dev
  seedTemplates(templates: JobTemplate[]) {
    templates.forEach(t => this.templates.set(t.id, t));
  }
}
