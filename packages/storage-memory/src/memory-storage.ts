import {
  IStoragePort,
  JobRecord,
  JobId,
  JobResult,
  JobIntentRecord,
  JobIntentId,
  DomainEvent,
} from '../../core/src/index.js';

export class MemoryStorage implements IStoragePort {
  private jobIntents = new Map<JobIntentId, JobIntentRecord>();
  private jobs = new Map<JobId, JobRecord>();
  private results = new Map<JobId, JobResult>();
  private domainEvents: DomainEvent[] = [];
  private auditLogs: any[] = [];

  private admissionLocks = new Set<string>();

  async saveJobIntent(intent: JobIntentRecord): Promise<void> {
    this.jobIntents.set(intent.intentId, intent);
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
    this.jobs.set(job.jobId, job);
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

  async putResultOnce(result: JobResult): Promise<JobResult> {
    const existing = this.results.get(result.jobId);
    if (existing) {
      return existing;
    }
    this.results.set(result.jobId, result);
    return result;
  }

  async getResult(jobId: JobId): Promise<JobResult | null> {
    return this.results.get(jobId) || null;
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

  getAuditLogs(): any[] {
    return this.auditLogs;
  }
}
