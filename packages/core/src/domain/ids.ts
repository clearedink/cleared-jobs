/**
 * Branded strings for type-safe IDs
 */
export type JobIntentId = string & { readonly __brand: unique symbol };
export type JobId = string & { readonly __brand: unique symbol };
export type PaymentId = string & { readonly __brand: unique symbol };

export const createJobIntentId = (id: string) => id as JobIntentId;
export const createJobId = (id: string) => id as JobId;
export const createPaymentId = (id: string) => id as PaymentId;
