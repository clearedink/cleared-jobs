import { EnqueueArgs } from '../domain/models.js';
import { JobStatus } from '../domain/statuses.js';
import { JobIntentId } from '../domain/ids.js';

export type AdmitPaidJobInput = {
  paymentId: string;
  intentId?: JobIntentId;
  payer: string;
  payTo?: string;
  amount: string;
  currency: 'USDC';
  network: string;
  txHash?: string;
  jobType: string;
  inputHash: string;
  payload: Record<string, unknown>;
  enqueue?: (args: EnqueueArgs) => Promise<void>;
  metadata?: Record<string, unknown>;
};

export type AdmitPaidJobResult = {
  type: 'admitted' | 'already_admitted';
  jobId: string;
  status: JobStatus;
  paymentId: string;
  intentId?: string;
  enqueueStatus?: 'not_requested' | 'queued' | 'failed';
};
