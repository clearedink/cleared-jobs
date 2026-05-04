import { randomUUID } from 'crypto';
import { IStoragePort } from '../ports/storage';
import { IClockPort } from '../ports/clock';
import { GetOrCreateJobIntentInput } from '../use-cases/job-intents';
import { JobIntentRecord } from '../domain/models';
import { createJobIntentId } from '../domain/ids';
import { IdempotencyConflictError } from '../lib/errors';

export async function getOrCreateJobIntent(
  input: GetOrCreateJobIntentInput,
  storage: IStoragePort,
  clock: IClockPort
): Promise<JobIntentRecord> {
  const existingIntent = await storage.findJobIntentByIdempotencyKey(input.buyerKey, input.idempotencyKey);
  
  if (existingIntent) {
    if (existingIntent.inputHash !== input.inputHash) {
      throw new IdempotencyConflictError(existingIntent.inputHash, input.inputHash);
    }
    return existingIntent;
  }

  const intentId = createJobIntentId(randomUUID());
  const now = clock.now().toISOString();

  const intent: JobIntentRecord = {
    intentId,
    idempotencyKey: input.idempotencyKey,
    buyerKey: input.buyerKey,
    jobType: input.jobType,
    inputHash: input.inputHash,
    price: input.price,
    payload: input.payload,
    status: 'requires_payment', // Using README status
    createdAt: now,
    updatedAt: now,
    expiresAt: input.expiresAt,
    metadata: input.metadata,
  };

  await storage.saveJobIntent(intent);

  await storage.saveAuditLog({
    id: randomUUID(),
    timestamp: new Date(now),
    action: 'JOB_INTENT_CREATED',
    actor: 'SYSTEM',
    resourceType: 'JOB_INTENT',
    resourceId: intentId,
    payload: { jobType: input.jobType, idempotencyKey: input.idempotencyKey },
    metadata: {},
  });

  return intent;
}
