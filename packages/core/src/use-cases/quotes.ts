import { JobTemplateId, QuoteId } from '../domain/ids';
import { Quote } from '../domain/models';

export interface CreateQuoteCommand {
  templateId: JobTemplateId;
  inputs: Record<string, any>;
}

export interface CreateQuoteResult {
  quote: Quote;
  paymentIntent: {
    externalId: string;
    clientConfig: Record<string, any>;
  };
}

export interface GetQuoteQuery {
  quoteId: QuoteId;
}
