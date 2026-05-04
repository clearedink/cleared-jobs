import { AttemptStatus, EscrowState, JobStatus, PaymentIntentStatus, ResolutionState } from './statuses';
import { ExecutionId, JobId, JobTemplateId, PaymentId, PaymentIntentId, ResolutionId } from './ids';

export interface JobTemplate {
  id: JobTemplateId;
  name: string;
  description?: string;
  priceAmount: bigint;
  priceCurrency: string;
  inputSchema: any;
  outputSchema: any;
  slaSeconds: number;
  timeoutPolicy: 'REFUND' | 'RETRY' | 'MANUAL';
  createdAt: Date;
}

export interface PaymentRequirement {
  paymentIdentifier: string;
  clientConfig: Record<string, any>;
}

export interface PaymentIntent {
  id: PaymentIntentId;
  templateId: JobTemplateId;
  inputHash: string;
  inputs: Record<string, any>;
  priceAmount: bigint;
  priceCurrency: string;
  paymentRequirement: PaymentRequirement;
  status: PaymentIntentStatus;
  expiresAt: Date;
  createdAt: Date;
}

/**
 * Encapsulates the financial life of a job.
 * Queryable independently from Job execution status.
 */
export interface PaymentRecord {
  id: PaymentId;
  paymentIntentId: PaymentIntentId;
  jobId?: JobId; // Linked once admitted
  paymentIdentifier: string; // The external reference (e.g. x402 address or transaction hash)
  amount: bigint;
  currency: string;
  escrowState: EscrowState;
  paymentRail: string;
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

/**
 * Result of a successful job execution.
 * Must remain retrievable even if response path failed.
 */
export interface JobResult {
  jobId: JobId;
  output: Record<string, any>;
  completedAt: Date;
}

/**
 * The final resolution of funds.
 * Decoupled from execution status.
 */
export interface ResolutionRecord {
  id: ResolutionId;
  jobId: JobId;
  state: ResolutionState;
  resolvedAt: Date;
  resolutionMetadata: Record<string, any>;
}

export interface Job {
  id: JobId; // The canonical identity for all post-payment actions
  paymentIntentId: PaymentIntentId;
  templateId: JobTemplateId;
  status: JobStatus;
  inputs: Record<string, any>;
  paymentIdentifier: string; // Link back to the immutable payment source
  currentAttemptId?: ExecutionId;
  resolutionId?: ResolutionId;
  deadlineAt: Date;
  createdAt: Date;
  updatedAt: Date;
}
