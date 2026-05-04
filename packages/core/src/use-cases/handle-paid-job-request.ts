import { JobStatus, JobIntentStatus } from '../domain/statuses';
import { JobPrice, VerifiedX402Payment, EnqueueArgs } from '../domain/models';

export type HandlePaidJobRequestInput = {
  idempotencyKey: string;
  buyerKey: string;
  jobType: string;
  inputHash: string;
  price: JobPrice;
  payload: Record<string, unknown>;
  payment?: VerifiedX402Payment;
  enqueue?: (args: EnqueueArgs) => Promise<void>;
  metadata?: Record<string, unknown>;
};

export type HandlePaidJobRequestResult =
  | JobIntentRequiredResult
  | PaidJobAcceptedResult;

export type JobIntentRequiredResult = {
  type: 'payment_required';
  intentId: string;
  paymentRequirement: unknown;
  status: JobIntentStatus;
};

export type PaidJobAcceptedResult = {
  type: 'accepted' | 'already_accepted';
  intentId: string;
  jobId: string;
  status: JobStatus;
  paymentId: string;
};
