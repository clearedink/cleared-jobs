import { JobStatus, PaymentIntentStatus } from '../domain/statuses';
import { JobId, PaymentIntentId } from '../domain/ids';
import { PaymentRequirement } from '../domain/models';

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
  
  /**
   * Provided by the application layer.
   */
  paymentRequirement: PaymentRequirement;

  /**
   * If provided, it means the application layer has already verified the payment.
   */
  verifiedPayment?: {
    paymentIdentifier: string;
    amount: bigint;
    currency: string;
    metadata?: Record<string, any>;
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
  paymentRequirement: PaymentRequirement;
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
