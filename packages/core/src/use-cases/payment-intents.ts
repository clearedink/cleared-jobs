import { JobTemplateId, PaymentIntentId } from '../domain/ids';

export interface GetOrCreatePaymentIntentCommand {
  idempotencyKey: string;
  buyerKey: string;
  jobType: string;
  inputHash: string;
  price: {
    amount: string;
    currency: string;
  };
  payload: Record<string, any>;
}

export interface GetOrCreatePaymentIntentResult {
  paymentIntentId: PaymentIntentId;
  paymentRequirement: {
    paymentIdentifier: string;
    clientConfig: Record<string, any>;
  };
  expiresAt: Date;
  price: {
    amount: string; // Serialized bigint
    currency: string;
  };
  slaSeconds: number;
  timeoutPolicy: string;
}

export interface GetPaymentIntentQuery {
  paymentIntentId: PaymentIntentId;
}
