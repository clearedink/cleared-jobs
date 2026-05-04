import { JobId, JobIntentId } from '../domain/ids';

export interface AdmitPaidJobCommand {
  jobIntentId: JobIntentId;
  
  /**
   * The canonical identifier for the payment (e.g. x402 address).
   * Assumed to be verified by the application layer.
   */
  paymentIdentifier: string;
  
  /**
   * The payment amount verified by the application layer.
   */
  amount: bigint;
  
  /**
   * The payment currency verified by the application layer.
   */
  currency: string;

  /**
   * Optional metadata about the verified payment.
   */
  paymentMetadata?: Record<string, any>;

  /**
   * Re-submitted inputs for structural verification (idempotency).
   */
  inputs: Record<string, any>;
}

export interface AdmitPaidJobResult {
  jobId: JobId;
  replayed: boolean;
}
