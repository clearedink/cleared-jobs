import { QuoteId, JobId } from '../domain/ids';

export interface AdmitFundedJobCommand {
  quoteId: QuoteId;
  paymentIdentifier: string;
  paymentProof: string; // The cryptographic or rail-specific proof of payment
  inputs: Record<string, any>; // Re-submitted for structural verification
}

export interface AdmitFundedJobResult {
  jobId: JobId;
  replayed: boolean;
}
