import { PaymentIntent } from '../domain/models';
import { PaymentIntentId } from '../domain/ids';

export interface PaymentIntentDetails {
  paymentIdentifier: string;
  clientConfig: Record<string, any>;
}

export interface IPaymentPort {
  /**
   * Generates a stable payment intent for a specific piece of work.
   */
  createIntent(intent: PaymentIntent): Promise<PaymentIntentDetails>;

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
