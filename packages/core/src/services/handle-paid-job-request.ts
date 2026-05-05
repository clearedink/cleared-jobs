import { IStoragePort } from '../ports/storage';
import { IClockPort } from '../ports/clock';
import {
  HandlePaidJobRequestInput,
  HandlePaidJobRequestResult
} from '../use-cases/handle-paid-job-request';
import { getOrCreateJobIntent } from './get-or-create-job-intent';
import { admitPaidJob } from './admit-paid-job';

export type PaymentRequirementGenerator = (intentId: string) => Promise<unknown>;

export async function handlePaidJobRequest(
  input: HandlePaidJobRequestInput,
  storage: IStoragePort,
  clock: IClockPort,
  generateRequirement?: PaymentRequirementGenerator
): Promise<HandlePaidJobRequestResult> {
  // 1. Ensure a stable payment intent exists
  // getOrCreateJobIntent now handles deriving idempotency if missing
  const intentResult = await getOrCreateJobIntent(
    {
      idempotencyKey: input.idempotencyKey,
      buyerKey: input.buyerKey,
      jobType: input.jobType,
      inputHash: input.inputHash,
      price: input.price,
      payload: input.payload,
    },
    storage,
    clock
  );

  // 2. If no payment provided, return payment requirement
  if (!input.payment) {
    let requirement = (intentResult as any).paymentRequirement; // internal engine check
    if (!requirement && generateRequirement) {
      requirement = await generateRequirement(intentResult.intentId);
    }

    return {
      type: 'payment_required',
      intentId: intentResult.intentId,
      paymentRequirement: requirement,
      status: intentResult.status,
    };
  }

  // 3. Payment provided -> Admit Job
  const admission = await admitPaidJob(
    {
      intentId: intentResult.intentId,
      paymentId: input.payment.paymentId,
      payer: input.payment.payer,
      payTo: input.payment.payTo,
      amount: input.payment.amount,
      currency: input.payment.currency,
      network: input.payment.network,
      txHash: input.payment.txHash,
      jobType: input.jobType,
      inputHash: input.inputHash,
      payload: input.payload,
      enqueue: input.enqueue,
      metadata: input.metadata,
    },
    storage,
    clock
  );

  return {
    type: admission.type,
    intentId: intentResult.intentId,
    jobId: admission.jobId,
    status: admission.status,
    paymentId: admission.paymentId,
    enqueueStatus: admission.enqueueStatus,
  };
}
