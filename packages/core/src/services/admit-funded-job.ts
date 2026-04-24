import { IStoragePort } from '../ports/storage';
import { IPaymentPort } from '../ports/payments';
import { IWorkerPort } from '../ports/workers';
import { AdmitFundedJobCommand, AdmitFundedJobResult } from '../use-cases/admit';

export async function admitFundedJob(
  command: AdmitFundedJobCommand,
  storage: IStoragePort,
  payments: IPaymentPort,
  workers: IWorkerPort
): Promise<AdmitFundedJobResult> {
  // TODO:
  // 1. Verify payment via payments.verifyPayment
  // 2. Check if job already exists for this quote/payment
  // 3. Create Job and PaymentRecord
  // 4. Update status to ADMITTED
  // 5. Dispatch job to workers via workers.dispatch
  // 6. Return success
  throw new Error('Not implemented');
}
