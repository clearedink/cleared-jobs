import { IStoragePort } from '../ports/storage';
import { IPaymentPort } from '../ports/payments';
import { IWorkerPort } from '../ports/workers';
import { AdmitFundedJobCommand, AdmitFundedJobResult } from '../use-cases/admit';

/**
 * Service to admit a job once funding is verified.
 * 
 * Enforces Invariant 1: one paymentIdentifier admits at most one job.
 * Enforces Invariant 2: one jobId is the canonical identity.
 */
export async function admitFundedJob(
  command: AdmitFundedJobCommand,
  storage: IStoragePort,
  payments: IPaymentPort,
  workers: IWorkerPort
): Promise<AdmitFundedJobResult> {
  // TODO:
  // 1. Check if a job already exists for this paymentIdentifier (Invariant 1)
  // 2. Verify payment via payments.verifyPayment(command.paymentIdentifier)
  // 3. Create canonical Job with new JobId (Invariant 2)
  // 4. Create internal PaymentRecord linked to Job
  // 5. Update status to FUNDED
  // 6. Dispatch job to workers
  // 7. Produce Audit Event (Invariant 6)
  throw new Error('Not implemented');
}
