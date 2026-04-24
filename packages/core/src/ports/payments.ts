import { Quote } from '../domain/models';
import { EscrowState } from '../domain/statuses';

export interface PaymentIntent {
  externalId: string;
  amount: bigint;
  currency: string;
  status: 'PENDING' | 'SUCCESS' | 'FAILED';
  clientConfig: Record<string, any>; // Used by frontend to complete payment
}

export interface IPaymentPort {
  /**
   * Initialize a payment for a specific quote
   */
  createIntent(quote: Quote): Promise<PaymentIntent>;

  /**
   * Verify a payment received from a rail
   */
  verifyPayment(externalId: string): Promise<{
    amount: bigint;
    currency: string;
    verified: boolean;
  }>;

  /**
   * Release funds from escrow to the provider
   */
  releaseEscrow(externalId: string): Promise<boolean>;

  /**
   * Refund funds from escrow back to the user
   */
  refundEscrow(externalId: string): Promise<boolean>;
}
