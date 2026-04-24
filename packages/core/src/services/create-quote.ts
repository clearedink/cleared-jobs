import { randomUUID } from 'crypto';
import { IStoragePort } from '../ports/storage';
import { IPaymentPort } from '../ports/payments';
import { IClockPort } from '../ports/clock';
import { CreateQuoteCommand, CreateQuoteResult } from '../use-cases/quotes';
import { EscrowState, QuoteStatus } from '../domain/statuses';
import { createPaymentId, createQuoteId } from '../domain/ids';
import { hashInputs } from '../lib/hash-input';
import { TemplateNotFoundError } from '../lib/errors';
import { Quote } from '../domain/models';

export async function createQuote(
  command: CreateQuoteCommand,
  storage: IStoragePort,
  payments: IPaymentPort,
  clock: IClockPort
): Promise<CreateQuoteResult> {
  // 1. Load the active job template
  const template = await storage.getTemplate(command.templateId);
  if (!template) {
    throw new TemplateNotFoundError(command.templateId);
  }

  // 2. Compute a deterministic input hash
  const inputHash = hashInputs(template.id, command.inputs);

  // 3. Check for an existing valid quote to ensure idempotency
  const existingQuote = await storage.findQuoteByInputHash(template.id, inputHash);
  if (existingQuote && existingQuote.status === QuoteStatus.OPEN && existingQuote.expiresAt > clock.now()) {
    const paymentRecord = await storage.getPaymentByQuoteId(existingQuote.id);
    if (paymentRecord) {
      return {
        quoteId: existingQuote.id,
        paymentRequirement: {
          paymentIdentifier: paymentRecord.paymentIdentifier,
          clientConfig: paymentRecord.metadata.clientConfig || {},
        },
        expiresAt: existingQuote.expiresAt,
        price: {
          amount: existingQuote.priceAmount.toString(),
          currency: existingQuote.priceCurrency,
        },
        slaSeconds: template.slaSeconds,
        timeoutPolicy: template.timeoutPolicy,
      };
    }
  }

  // 4. Generate new Quote details
  const quoteId = createQuoteId(randomUUID());
  const expiresAt = new Date(clock.now().getTime() + 15 * 60 * 1000); // 15 minute default window

  const quote: Quote = {
    id: quoteId,
    templateId: template.id,
    inputHash,
    inputs: command.inputs,
    priceAmount: template.priceAmount,
    priceCurrency: template.priceCurrency,
    status: QuoteStatus.OPEN,
    expiresAt,
    createdAt: clock.now(),
  };

  // 5. Ask the payment adapter to create a payment requirement
  const intent = await payments.createIntent(quote);

  // 6. Persist the quote
  await storage.saveQuote(quote);

  // 7. Persist an initial payment record (linkage)
  await storage.savePayment({
    id: createPaymentId(randomUUID()),
    quoteId: quote.id,
    paymentIdentifier: intent.paymentIdentifier,
    amount: template.priceAmount,
    currency: template.priceCurrency,
    escrowState: EscrowState.NOT_FUNDED,
    paymentRail: 'UNKNOWN', // Ideally intent clarifies this
    metadata: {
      clientConfig: intent.clientConfig,
      buyerId: command.buyerId,
    },
    createdAt: clock.now(),
    updatedAt: clock.now(),
  });

  // 8. Append a QUOTE_CREATED audit event
  await storage.saveAuditLog({
    id: randomUUID(),
    timestamp: clock.now(),
    action: 'QUOTE_CREATED',
    actor: command.buyerId,
    resourceType: 'QUOTE',
    resourceId: quote.id,
    payload: {
      templateId: template.id,
      inputHash,
    },
    metadata: {},
  });

  return {
    quoteId: quote.id,
    paymentRequirement: {
      paymentIdentifier: intent.paymentIdentifier,
      clientConfig: intent.clientConfig,
    },
    expiresAt: quote.expiresAt,
    price: {
      amount: quote.priceAmount.toString(),
      currency: quote.priceCurrency,
    },
    slaSeconds: template.slaSeconds,
    timeoutPolicy: template.timeoutPolicy,
  };
}
