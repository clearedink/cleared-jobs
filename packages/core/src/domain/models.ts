import { JobStatus, JobIntentStatus, JobFailureResolution } from './statuses';

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
