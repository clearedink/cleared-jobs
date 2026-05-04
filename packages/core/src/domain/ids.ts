/**
 * Branded strings for type-safe IDs
 */
export type JobTemplateId = string & { readonly __brand: unique symbol };
export type PaymentIntentId = string & { readonly __brand: unique symbol };
export type JobId = string & { readonly __brand: unique symbol };
export type PaymentId = string & { readonly __brand: unique symbol };
export type ExecutionId = string & { readonly __brand: unique symbol };
export type ResolutionId = string & { readonly __brand: unique symbol };

export const createJobTemplateId = (id: string) => id as JobTemplateId;
export const createPaymentIntentId = (id: string) => id as PaymentIntentId;
export const createJobId = (id: string) => id as JobId;
export const createPaymentId = (id: string) => id as PaymentId;
export const createExecutionId = (id: string) => id as ExecutionId;
export const createResolutionId = (id: string) => id as ResolutionId;
