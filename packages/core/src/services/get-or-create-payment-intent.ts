import { randomUUID } from 'crypto';
import { IStoragePort } from '../ports/storage';
import { IPaymentPort } from '../ports/payments';
import { IClockPort } from '../ports/clock';
import { GetOrCreatePaymentIntentCommand, GetOrCreatePaymentIntentResult } from '../use-cases/payment-intents';
import { EscrowState, PaymentIntentStatus } from '../domain/statuses';
import { createPaymentId, createPaymentIntentId, createJobTemplateId } from '../domain/ids';
import { TemplateNotFoundError } from '../lib/errors';
import { PaymentIntent } from '../domain/models';

export async function getOrCreatePaymentIntent(
  command: GetOrCreatePaymentIntentCommand,
  storage: IStoragePort,
  payments: IPaymentPort,
  clock: IClockPort
): Promise<GetOrCreatePaymentIntentResult> {
  // 1. Load the active job template by type
  // Note: For now we assume templateId matches jobType or we find it by name
  const templateId = createJobTemplateId(command.jobType);
  const template = await storage.getTemplate(templateId);
  if (!template) {
    throw new TemplateNotFoundError(templateId);
  }

  // 2. Check for an existing valid intent to ensure idempotency
  // We use jobType + inputHash as the stable lookup
  const existingIntent = await storage.findPaymentIntentByInputHash(template.id, command.inputHash);
  
  if (existingIntent && existingIntent.status === PaymentIntentStatus.OPEN && existingIntent.expiresAt > clock.now()) {
    const paymentRecord = await storage.getPaymentByPaymentIntentId(existingIntent.id);
    if (paymentRecord) {
      return {
        paymentIntentId: existingIntent.id,
        paymentRequirement: {
          paymentIdentifier: paymentRecord.paymentIdentifier,
          clientConfig: paymentRecord.metadata.clientConfig || {},
        },
        expiresAt: existingIntent.expiresAt,
        price: {
          amount: existingIntent.priceAmount.toString(),
          currency: existingIntent.priceCurrency,
        },
        slaSeconds: template.slaSeconds,
        timeoutPolicy: template.timeoutPolicy,
      };
    }
  }

  // 3. Generate new Payment Intent details
  const paymentIntentId = createPaymentIntentId(randomUUID());
  const expiresAt = new Date(clock.now().getTime() + 15 * 60 * 1000); // 15 minute default window

  const intentModel: PaymentIntent = {
    id: paymentIntentId,
    templateId: template.id,
    inputHash: command.inputHash,
    inputs: command.payload,
    priceAmount: BigInt(command.price.amount),
    priceCurrency: command.price.currency,
    status: PaymentIntentStatus.OPEN,
    expiresAt,
    createdAt: clock.now(),
  };

  // 4. Ask the payment adapter to create a payment requirement
  const intentDetails = await payments.createIntent(intentModel);

  // 5. Persist the intent
  await storage.savePaymentIntent(intentModel);

  // 6. Persist an initial payment record (linkage)
  await storage.savePayment({
    id: createPaymentId(randomUUID()),
    paymentIntentId: intentModel.id,
    paymentIdentifier: intentDetails.paymentIdentifier,
    amount: intentModel.priceAmount,
    currency: intentModel.priceCurrency,
    escrowState: EscrowState.NOT_FUNDED,
    paymentRail: 'UNKNOWN',
    metadata: {
      clientConfig: intentDetails.clientConfig,
      buyerKey: command.buyerKey,
      idempotencyKey: command.idempotencyKey,
    },
    createdAt: clock.now(),
    updatedAt: clock.now(),
  });

  // 7. Append a PAYMENT_INTENT_CREATED audit event
  await storage.saveAuditLog({
    id: randomUUID(),
    timestamp: clock.now(),
    action: 'PAYMENT_INTENT_CREATED',
    actor: command.buyerKey,
    resourceType: 'PAYMENT_INTENT',
    resourceId: intentModel.id,
    payload: {
      jobType: command.jobType,
      inputHash: command.inputHash,
      idempotencyKey: command.idempotencyKey,
    },
    metadata: {},
  });

  return {
    paymentIntentId: intentModel.id,
    paymentRequirement: {
      paymentIdentifier: intentDetails.paymentIdentifier,
      clientConfig: intentDetails.clientConfig,
    },
    expiresAt: intentModel.expiresAt,
    price: {
      amount: intentModel.priceAmount.toString(),
      currency: intentModel.priceCurrency,
    },
    slaSeconds: template.slaSeconds,
    timeoutPolicy: template.timeoutPolicy,
  };
}
