import { randomUUID } from 'crypto';
import { IStoragePort } from '../ports/storage';
import { IClockPort } from '../ports/clock';
import { 
  GetOrCreatePaymentIntentCommand, 
  GetOrCreatePaymentIntentResult 
} from '../use-cases/payment-intents';
import { PaymentIntentStatus } from '../domain/statuses';
import { createPaymentIntentId } from '../domain/ids';
import { TemplateNotFoundError } from '../lib/errors';
import { PaymentIntent } from '../domain/models';

export async function getOrCreatePaymentIntent(
  command: GetOrCreatePaymentIntentCommand,
  storage: IStoragePort,
  clock: IClockPort
): Promise<GetOrCreatePaymentIntentResult> {
  // 1. Load template first to get templateId
  const template = await storage.getTemplateByJobType(command.jobType);
  if (!template) {
    throw new TemplateNotFoundError(command.jobType);
  }

  // 2. Check for existing intent by input hash + templateId
  const existingIntent = await storage.findPaymentIntentByInputHash(template.id, command.inputHash);
  
  if (existingIntent) {
    if (existingIntent.expiresAt > clock.now()) {
      return {
        paymentIntentId: existingIntent.id,
        paymentRequirement: existingIntent.paymentRequirement,
        price: {
          amount: existingIntent.priceAmount.toString(),
          currency: existingIntent.priceCurrency,
        },
        expiresAt: existingIntent.expiresAt,
      };
    }
  }

  // 3. Create new Intent
  const intentId = createPaymentIntentId(randomUUID());
  const expiresAt = new Date(clock.now().getTime() + 3600 * 1000); // 1 hour default

  const intent: PaymentIntent = {
    id: intentId,
    templateId: template.id,
    inputHash: command.inputHash,
    inputs: command.payload,
    priceAmount: template.priceAmount,
    priceCurrency: template.priceCurrency,
    paymentRequirement: command.paymentRequirement,
    status: PaymentIntentStatus.OPEN,
    expiresAt,
    createdAt: clock.now(),
  };

  await storage.savePaymentIntent(intent);

  // 4. Log the intention
  await storage.saveAuditLog({
    id: randomUUID(),
    timestamp: clock.now(),
    action: 'PAYMENT_INTENT_CREATED',
    actor: 'SYSTEM',
    resourceType: 'PAYMENT_INTENT' as any,
    resourceId: intentId,
    payload: { jobType: command.jobType, idempotencyKey: command.idempotencyKey },
    metadata: {},
  });

  return {
    paymentIntentId: intentId,
    paymentRequirement: command.paymentRequirement,
    price: {
      amount: template.priceAmount.toString(),
      currency: template.priceCurrency,
    },
    expiresAt,
  };
}
