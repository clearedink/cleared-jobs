import { JobStatus, PaymentIntentStatus } from '../domain/statuses';
import { JobId, PaymentIntentId } from '../domain/ids';

export interface HandlePaidJobRequestCommand {
  idempotencyKey: string;
  buyerKey: string;
  jobType: string;
  inputHash: string;
  price: {
    amount: string;
    currency: string;
  };
  payload: Record<string, any>;
  payment?: {
    paymentIdentifier: string;
    paymentProof: string;
  };
  enqueue?: (args: { jobId: JobId }) => Promise<void>;
  metadata?: Record<string, any>;
}

export type HandlePaidJobRequestResult =
  | PaymentRequiredResult
  | PaidJobAcceptedResult;

export interface PaymentRequiredResult {
  type: 'payment_required';
  paymentIntentId: PaymentIntentId;
  paymentRequirement: {
    paymentIdentifier: string;
    clientConfig: Record<string, any>;
  };
  status: PaymentIntentStatus;
  expiresAt: Date;
  price: {
    amount: string;
    currency: string;
  };
}

export interface PaidJobAcceptedResult {
  type: 'accepted' | 'already_accepted';
  paymentIntentId: PaymentIntentId;
  jobId: JobId;
  status: JobStatus;
}
