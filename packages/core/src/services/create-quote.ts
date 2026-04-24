import { IStoragePort } from '../ports/storage';
import { IPaymentPort } from '../ports/payments';
import { IClockPort } from '../ports/clock';
import { CreateQuoteCommand, CreateQuoteResult } from '../use-cases/quotes';

export async function createQuote(
  command: CreateQuoteCommand,
  storage: IStoragePort,
  payments: IPaymentPort,
  clock: IClockPort
): Promise<CreateQuoteResult> {
  // TODO:
  // 1. Get job template from storage
  // 2. Hash inputs to check for idempotency/existing quote
  // 3. Create or update quote
  // 4. Call payments.createIntent for the quote
  // 5. Save quote and return result
  throw new Error('Not implemented');
}
