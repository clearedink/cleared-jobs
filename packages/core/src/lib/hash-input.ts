import { createHash } from 'crypto';

/**
 * Creates a stable hash of job input for idempotency.
 */
export function hashJobInput(jobType: string, payload: Record<string, any>): string {
  const normalized = JSON.stringify(payload, Object.keys(payload).sort());
  return createHash('sha256')
    .update(`${jobType}:${normalized}`)
    .digest('hex');
}
