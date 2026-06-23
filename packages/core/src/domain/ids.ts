/**
 * Branded strings for type-safe IDs
 */
export type JobIntentId = string & { readonly __brand: "JobIntentId" };
export type JobId = string & { readonly __brand: "JobId" };
export type PaymentId = string & { readonly __brand: "PaymentId" };

export const createJobIntentId = (id: string) => id as JobIntentId;
export const createJobId = (id: string) => id as JobId;
export const createPaymentId = (id: string) => id as PaymentId;
