import { QuoteId, JobId } from '../domain/ids';

export interface AdmitFundedJobCommand {
  quoteId: QuoteId;
  paymentIdentifier: string; // The canonical payment reference
}

export interface AdmitFundedJobResult {
  jobId: JobId;
  status: 'SUCCESS' | 'ALREADY_ADMITTED' | 'PAYMENT_NOT_FOUND' | 'QUOTE_EXPIRED';
}
