import { IStoragePort } from '../ports/storage';
import { IPaymentPort } from '../ports/payments';
import { IClockPort } from '../ports/clock';
import {
  HandlePaidJobRequestCommand,
  HandlePaidJobRequestResult
} from '../use-cases/handle-paid-job-request';
import { getOrCreatePaymentIntent } from './get-or-create-payment-intent';
import { admitFundedJob } from './admit-funded-job';
import { dispatchJob } from './operator-actions'; // Or wherever dispatch is defined

export async function handlePaidJobRequest(
  command: HandlePaidJobRequestCommand,
  storage: IStoragePort,
  payments: IPaymentPort,
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
    },
    storage,
    payments,
    clock
  );

  // 2. If no payment provided, return payment requirement
  if (!command.payment) {
    return {
      type: 'payment_required',
      paymentIntentId: intentResult.paymentIntentId,
      paymentRequirement: intentResult.paymentRequirement,
      status: 'OPEN' as any, // This should probably come from intentResult if we added it
      expiresAt: intentResult.expiresAt,
      price: intentResult.price,
    };
  }

  // 3. Payment provided -> Admit Job
  const admission = await admitFundedJob(
    {
      paymentIntentId: intentResult.paymentIntentId,
      paymentIdentifier: command.payment.paymentIdentifier,
      paymentProof: command.payment.paymentProof,
      inputs: command.payload,
    },
    storage,
    payments,
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
    status: 'FUNDED' as any, // Should be JobStatus.FUNDED
  };
}
