import { createHash } from 'crypto';

/**
 * Standardize input hashing for quote idempotency
 */
export function hashInputs(templateId: string, inputs: Record<string, any>): string {
  const payload = JSON.stringify({
    templateId,
    inputs: Object.keys(inputs)
      .sort()
      .reduce((acc, key) => {
        acc[key] = inputs[key];
        return acc;
      }, {} as any),
  });

  return createHash('sha256').update(payload).digest('hex');
}
