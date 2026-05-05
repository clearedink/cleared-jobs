import { EnqueueArgs } from '../domain/models';
import { JobStatus } from '../domain/statuses';

export type AdmitPaidJobInput = {
  paymentId: string;
  intentId?: string;
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
