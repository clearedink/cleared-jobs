import { JobTemplateId, QuoteId } from '../domain/ids';

export interface CreateQuoteCommand {
  templateId: JobTemplateId;
  buyerId: string;
  inputs: Record<string, any>;
}

export interface CreateQuoteResult {
  quoteId: QuoteId;
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

export interface GetQuoteQuery {
  quoteId: QuoteId;
}
