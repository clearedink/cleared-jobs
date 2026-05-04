import { IStoragePort } from '../ports/storage';
import { IClockPort } from '../ports/clock';
import {
  HandlePaidJobRequestCommand,
  HandlePaidJobRequestResult
} from '../use-cases/handle-paid-job-request';
import { getOrCreatePaymentIntent } from './get-or-create-payment-intent';
import { admitFundedJob } from './admit-funded-job';
import { JobStatus, PaymentIntentStatus } from '../domain/statuses';

export async function handlePaidJobRequest(
  command: HandlePaidJobRequestCommand,
  storage: IStoragePort,
  clock: IClockPort
): Promise<HandlePaidJobRequestResult> {
  // 1. Ensure a stable payment intent exists
  const intentResult = await getOrCreatePaymentIntent(
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

  // 2. If no payment provided (or not verified), return payment requirement
  if (!command.verifiedPayment) {
    return {
      type: 'payment_required',
      paymentIntentId: intentResult.paymentIntentId,
      paymentRequirement: intentResult.paymentRequirement,
      status: PaymentIntentStatus.OPEN,
      expiresAt: intentResult.expiresAt,
      price: intentResult.price,
    };
  }

  // 3. Payment verified -> Admit Job
  const admission = await admitFundedJob(
    {
      paymentIntentId: intentResult.paymentIntentId,
      paymentIdentifier: command.verifiedPayment.paymentIdentifier,
      amount: command.verifiedPayment.amount,
      currency: command.verifiedPayment.currency,
      paymentMetadata: command.verifiedPayment.metadata,
      inputs: command.payload,
    },
    storage,
    clock
  );

  // 4. Handoff to optional enqueue callback if not a replay
  if (!admission.replayed && command.enqueue) {
    await command.enqueue({ jobId: admission.jobId });
  }

  return {
    type: admission.replayed ? 'already_accepted' : 'accepted',
    paymentIntentId: intentResult.paymentIntentId,
    jobId: admission.jobId,
    status: JobStatus.ADMITTED,
  };
}
