import { IStoragePort } from '../ports/storage';
import { IClockPort } from '../ports/clock';
import {
  HandlePaidJobRequestCommand,
  HandlePaidJobRequestResult
} from '../use-cases/handle-paid-job-request';
import { getOrCreateJobIntent } from './get-or-create-job-intent';
import { admitPaidJob } from './admit-paid-job';
import { JobStatus, JobIntentStatus } from '../domain/statuses';

export async function handlePaidJobRequest(
  command: HandlePaidJobRequestCommand,
  storage: IStoragePort,
  clock: IClockPort
): Promise<HandlePaidJobRequestResult> {
  const intentResult = await getOrCreateJobIntent(
    {
      idempotencyKey: command.idempotencyKey,
      buyerKey: command.buyerKey,
      jobType: command.jobType,
      inputHash: command.inputHash,
      price: command.price,
      payload: command.payload,
      paymentRequirement: command.paymentRequirement,
    },
    storage,
    clock
  );

  if (!command.verifiedPayment) {
    return {
      type: 'payment_required',
      jobIntentId: intentResult.jobIntentId,
      paymentRequirement: intentResult.paymentRequirement,
      status: JobIntentStatus.OPEN,
      expiresAt: intentResult.expiresAt,
      price: intentResult.price,
    };
  }

  const admission = await admitPaidJob(
    {
      jobIntentId: intentResult.jobIntentId,
      paymentIdentifier: command.verifiedPayment.paymentIdentifier,
      amount: command.verifiedPayment.amount,
      currency: command.verifiedPayment.currency,
      paymentMetadata: command.verifiedPayment.metadata,
      inputs: command.payload,
    },
    storage,
    clock
  );

  if (!admission.replayed && command.enqueue) {
    await command.enqueue({ jobId: admission.jobId });
  }

  return {
    type: admission.replayed ? 'already_accepted' : 'accepted',
    jobIntentId: intentResult.jobIntentId,
    jobId: admission.jobId,
    status: JobStatus.ADMITTED,
  };
}
