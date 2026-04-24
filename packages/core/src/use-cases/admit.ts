import { QuoteId, JobId } from '../domain/ids';

export interface AdmitFundedJobCommand {
  quoteId: QuoteId;
  paymentTransactionId: string;
}

export interface AdmitFundedJobResult {
  jobId: JobId;
  status: 'SUCCESS' | 'ALREADY_ADMITTED' | 'PAYMENT_NOT_FOUND' | 'QUOTE_EXPIRED';
}
