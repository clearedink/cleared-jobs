import { AttemptStatus, EscrowState, JobStatus, JobIntentStatus, ResolutionState, JobFailureResolution } from './statuses';
import { ExecutionId, JobId, JobTemplateId, ResolutionId } from './ids';

// -----------------------------------------------------------------------------
// Public API Types from README
// -----------------------------------------------------------------------------

export type JobPrice = {
  amount: string;
  currency: 'USDC';
  network: string;
};

export type VerifiedX402Payment = {
  paymentId: string;
  payer: string;
  payTo?: string;
  amount: string;
  currency: 'USDC';
  network: string;
  txHash?: string;
  raw?: unknown;
};

export type JobIntentRecord = {
  intentId: string;
  idempotencyKey: string;
  buyerKey: string;
  jobType: string;
  inputHash: string;
  price: JobPrice;
  payload: Record<string, unknown>;
  status: JobIntentStatus;
  jobId?: string;
  paymentId?: string;
  createdAt: string;
  updatedAt: string;
  expiresAt?: string;
  metadata?: Record<string, unknown>;
};

export type JobRecord = {
  jobId: string;
  intentId?: string;
  paymentId?: string;
  payer?: string;
  payTo?: string;
  amount?: string;
  currency?: 'USDC';
  network?: string;
  txHash?: string;
  jobType: string;
  status: JobStatus;
  inputHash: string;
  payload: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  queuedAt?: string;
  startedAt?: string;
  completedAt?: string;
  failedAt?: string;
  failureReason?: string;
  failureResolution?: JobFailureResolution;
  metadata?: Record<string, unknown>;
};

export type JobResult = {
  jobId: string;
  result: Record<string, unknown>;
  resultType?: string;
  createdAt: string;
};

export type EnqueueArgs = {
  jobId: string;
  jobType: string;
  payload: Record<string, unknown>;
};

// -----------------------------------------------------------------------------
// Internal Engine Types (Not in public API README but used internally)
// -----------------------------------------------------------------------------

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

export interface ExecutionAttempt {
  id: ExecutionId;
  jobId: JobId;
  status: AttemptStatus;
  workerId?: string;
  startedAt?: Date;
  finishedAt?: Date;
  error?: string;
}

export interface ResolutionRecord {
  id: ResolutionId;
  jobId: JobId;
  state: ResolutionState;
  resolvedAt: Date;
  resolutionMetadata: Record<string, any>;
}
