import {
  ExecutionAttempt,
  ExecutionId,
  IStoragePort,
  JobRecord,
  JobId,
  JobResult,
  JobTemplate,
  JobTemplateId,
  JobIntentRecord,
  JobIntentId,
  ResolutionId,
  ResolutionRecord,
  DomainEvent,
} from '@cleared/core';

export class MemoryStorage implements IStoragePort {
  private templates = new Map<JobTemplateId, JobTemplate>();
  private jobIntents = new Map<JobIntentId, JobIntentRecord>();
  private jobs = new Map<JobId, JobRecord>();
  private attempts = new Map<ExecutionId, ExecutionAttempt>();
  private results = new Map<JobId, JobResult>();
  private resolutions = new Map<ResolutionId, ResolutionRecord>();
  private domainEvents: DomainEvent[] = [];
  private auditLogs: any[] = [];

  private admissionLocks = new Set<string>();

  async getTemplate(id: JobTemplateId): Promise<JobTemplate | null> {
    return this.templates.get(id) || null;
  }

  async getTemplateByJobType(jobType: string): Promise<JobTemplate | null> {
    return Array.from(this.templates.values()).find(t => t.id === jobType) || null;
  }

  async listTemplates(): Promise<JobTemplate[]> {
    return Array.from(this.templates.values());
  }

  async saveJobIntent(intent: JobIntentRecord): Promise<void> {
    this.jobIntents.set(intent.intentId as any, intent);
  }

  async getJobIntent(id: JobIntentId): Promise<JobIntentRecord | null> {
    return this.jobIntents.get(id) || null;
  }

  async findJobIntentByIdempotencyKey(buyerKey: string, idempotencyKey: string): Promise<JobIntentRecord | null> {
    return Array.from(this.jobIntents.values()).find(
      q => q.buyerKey === buyerKey && q.idempotencyKey === idempotencyKey
    ) || null;
  }

  async getJobByPaymentId(network: string, paymentId: string): Promise<JobRecord | null> {
    return Array.from(this.jobs.values()).find(j => j.network === network && j.paymentId === paymentId) || null;
  }

  async saveJob(job: JobRecord): Promise<void> {
    this.jobs.set(job.jobId as any, job);
  }

  async getJob(id: JobId): Promise<JobRecord | null> {
    return this.jobs.get(id) || null;
  }

  async getJobByJobIntentId(jobIntentId: JobIntentId): Promise<JobRecord | null> {
    return Array.from(this.jobs.values()).find(j => j.intentId === jobIntentId) || null;
  }

  async listActiveJobs(): Promise<JobRecord[]> {
    const terminalStatuses = ['completed', 'failed', 'cancelled'];
    return Array.from(this.jobs.values()).filter(j => !terminalStatuses.includes(j.status));
  }

  async saveResult(result: JobResult): Promise<void> {
    this.results.set(result.jobId as any, result);
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

  async seedTemplates(templates: JobTemplate[]) {
    templates.forEach(t => this.templates.set(t.id, t));
  }
}
