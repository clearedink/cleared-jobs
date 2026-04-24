import { Quote } from '../domain/models';

export interface PaymentIntent {
  paymentIdentifier: string; // The canonical identifier for this funding event
  amount: bigint;
  currency: string;
  status: 'OPEN' | 'FUNDED' | 'EXPIRED';
  clientConfig: Record<string, any>;
}

export interface IPaymentPort {
  /**
   * Initialize a payment for a specific quote.
   * Returns the paymentIdentifier which will be used to admit the job.
   */
  createIntent(quote: Quote): Promise<PaymentIntent>;

  /**
   * Verify a payment received from a rail.
   * must return the canonical paymentIdentifier for that rail.
   */
  verifyPayment(paymentIdentifier: string): Promise<{
    amount: bigint;
    currency: string;
    verified: boolean;
  }>;

  /**
   * Verify a cryptographic proof of payment
   */
  verifyProof(proof: string): Promise<{
    paymentIdentifier: string;
    amount: bigint;
    currency: string;
    verified: boolean;
  }>;

  /**
   * Release funds from escrow to the provider.
   */
  releaseEscrow(paymentIdentifier: string): Promise<boolean>;

  /**
   * Refund funds from escrow back to the user.
   */
  refundEscrow(paymentIdentifier: string): Promise<boolean>;
}
