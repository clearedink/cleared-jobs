import { JobPrice } from '../domain/models.js';

export type GetOrCreateJobIntentInput = {
  idempotencyKey?: string;
  buyerKey?: string;
  jobType: string;
  inputHash: string;
  price: JobPrice;
  payload: Record<string, unknown>;
  expiresAt?: string;
  metadata?: Record<string, unknown>;
};
