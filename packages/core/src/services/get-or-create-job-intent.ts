import { randomUUID } from 'crypto';
import { IStoragePort } from '../ports/storage';
import { IClockPort } from '../ports/clock';
import { 
  GetOrCreateJobIntentCommand, 
  GetOrCreateJobIntentResult 
} from '../use-cases/job-intents';
import { JobIntentStatus } from '../domain/statuses';
import { createJobIntentId } from '../domain/ids';
import { TemplateNotFoundError } from '../lib/errors';
import { JobIntent } from '../domain/models';

export async function getOrCreateJobIntent(
  command: GetOrCreateJobIntentCommand,
  storage: IStoragePort,
  clock: IClockPort
): Promise<GetOrCreateJobIntentResult> {
  const template = await storage.getTemplateByJobType(command.jobType);
  if (!template) {
    throw new TemplateNotFoundError(command.jobType);
  }

  const existingIntent = await storage.findJobIntentByInputHash(template.id, command.inputHash);
  
  if (existingIntent) {
    if (existingIntent.expiresAt > clock.now()) {
      return {
        jobIntentId: existingIntent.id,
        paymentRequirement: existingIntent.paymentRequirement,
        price: {
          amount: existingIntent.priceAmount.toString(),
          currency: existingIntent.priceCurrency,
        },
        expiresAt: existingIntent.expiresAt,
      };
    }
  }

  const intentId = createJobIntentId(randomUUID());
  const expiresAt = new Date(clock.now().getTime() + 3600 * 1000); // 1 hour default

  const intent: JobIntent = {
    id: intentId,
    templateId: template.id,
    inputHash: command.inputHash,
    inputs: command.payload,
    priceAmount: template.priceAmount,
    priceCurrency: template.priceCurrency,
    paymentRequirement: command.paymentRequirement,
    status: JobIntentStatus.OPEN,
    expiresAt,
    createdAt: clock.now(),
  };

  await storage.saveJobIntent(intent);

  await storage.saveAuditLog({
    id: randomUUID(),
    timestamp: clock.now(),
    action: 'JOB_INTENT_CREATED',
    actor: 'SYSTEM',
    resourceType: 'JOB_INTENT' as any,
    resourceId: intentId,
    payload: { jobType: command.jobType, idempotencyKey: command.idempotencyKey },
    metadata: {},
  });

  return {
    jobIntentId: intentId,
    paymentRequirement: command.paymentRequirement,
    price: {
      amount: template.priceAmount.toString(),
      currency: template.priceCurrency,
    },
    expiresAt,
  };
}
