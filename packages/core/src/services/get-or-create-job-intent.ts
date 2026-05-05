import { randomUUID, createHash } from 'crypto';
import { IStoragePort } from '../ports/storage.js';
import { IClockPort } from '../ports/clock.js';
import { GetOrCreateJobIntentInput } from '../use-cases/job-intents.js';
import { JobIntentRecord } from '../domain/models.js';
import { createJobIntentId } from '../domain/ids.js';
import { IdempotencyConflictError } from '../lib/errors.js';

export async function getOrCreateJobIntent(
  input: GetOrCreateJobIntentInput,
  storage: IStoragePort,
  clock: IClockPort
): Promise<JobIntentRecord> {
  let lookupKey = input.idempotencyKey;
  let buyerKey = input.buyerKey;

  // 1. Resolve idempotency lookup key
  if (!lookupKey && buyerKey) {
    // Derive from buyer + work identity
    lookupKey = createHash('sha256')
      .update(`${buyerKey}:${input.jobType}:${input.inputHash}`)
      .digest('hex');
  }

  // 2. Perform lookup if we have a key
  if (lookupKey) {
    const existingIntent = await storage.findJobIntentByIdempotencyKey(buyerKey || 'anonymous', lookupKey);
    
    if (existingIntent) {
      if (existingIntent.inputHash !== input.inputHash) {
        throw new IdempotencyConflictError(existingIntent.inputHash, input.inputHash);
      }
      return existingIntent;
    }
  }

  // 3. Create new intent
  const intentId = createJobIntentId(randomUUID());
  const now = clock.now().toISOString();

  const intent: JobIntentRecord = {
    intentId,
    idempotencyKey: lookupKey || randomUUID(), // fallback for record integrity
    buyerKey: buyerKey || 'anonymous',
    jobType: input.jobType,
    inputHash: input.inputHash,
    price: input.price,
    payload: input.payload,
    status: 'requires_payment',
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
    actor: buyerKey || 'SYSTEM',
    resourceType: 'JOB_INTENT',
    resourceId: intentId,
    payload: { jobType: input.jobType, idempotencyKey: intent.idempotencyKey },
    metadata: {},
  });

  return intent;
}
