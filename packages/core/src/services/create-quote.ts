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
  // 2. Hash inputs for idempotency
  // 3. Create or update quote with status OPEN
  // 4. Call payments.createIntent
  // 5. Save quote and produce Audit Event (Invariant 6)
  throw new Error('Not implemented');
}
