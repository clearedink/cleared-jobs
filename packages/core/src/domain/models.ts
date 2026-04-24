import { AttemptStatus, EscrowState, JobStatus, QuoteStatus, ResolutionState } from './statuses';
import { ExecutionId, JobId, JobTemplateId, PaymentId, QuoteId, ResolutionId } from './ids';

export interface JobTemplate {
  id: JobTemplateId;
  name: string;
  description?: string;
  priceAmount: bigint;
  priceCurrency: string;
  inputSchema: any; // JSON Schema or similar
  outputSchema: any;
  createdAt: Date;
}

export interface Quote {
  id: QuoteId;
  templateId: JobTemplateId;
  inputHash: string;
  inputs: Record<string, any>;
  priceAmount: bigint;
  priceCurrency: string;
  status: QuoteStatus;
  expiresAt: Date;
  createdAt: Date;
}

export interface PaymentRecord {
  id: PaymentId;
  quoteId: QuoteId;
  externalTransactionId?: string;
  amount: bigint;
  currency: string;
  escrowState: EscrowState;
  paymentRail: string; // e.g. 'x402', 'stripe', etc.
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface ExecutionAttempt {
  id: ExecutionId;
  jobId: JobId;
  status: AttemptStatus;
  workerId?: string;
  startedAt?: Date;
  finishedAt?: Date;
  error?: string;
}

export interface JobResult {
  jobId: JobId;
  output: Record<string, any>;
  completedAt: Date;
}

export interface ResolutionRecord {
  id: ResolutionId;
  jobId: JobId;
  state: ResolutionState;
  resolvedAt: Date;
  resolutionMetadata: Record<string, any>;
}

export interface Job {
  id: JobId;
  quoteId: QuoteId;
  templateId: JobTemplateId;
  status: JobStatus;
  inputs: Record<string, any>;
  paymentId?: PaymentId;
  currentAttemptId?: ExecutionId;
  resolutionId?: ResolutionId;
  createdAt: Date;
  updatedAt: Date;
}
