export class DomainError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'DomainError';
  }
}

export class TemplateNotFoundError extends DomainError {
  constructor(templateId: string) {
    super(`Job template ${templateId} not found`, 'TEMPLATE_NOT_FOUND');
  }
}

export class QuoteNotFoundError extends DomainError {
  constructor(quoteId: string) {
    super(`Quote ${quoteId} not found`, 'QUOTE_NOT_FOUND');
  }
}

export class QuoteExpiredError extends DomainError {
  constructor(quoteId: string) {
    super(`Quote ${quoteId} has expired`, 'QUOTE_EXPIRED');
  }
}

export class QuoteAlreadyFundedError extends DomainError {
  constructor(quoteId: string) {
    super(`Quote ${quoteId} has already been funded`, 'QUOTE_ALREADY_FUNDED');
  }
}

export class InvalidPaymentProofError extends DomainError {
  constructor(identifier: string) {
    super(`Invalid payment proof for identifier ${identifier}`, 'INVALID_PAYMENT_PROOF');
  }
}

export class PaymentIdentifierMismatchError extends DomainError {
  constructor(expected: string, actual: string) {
    super(`Payment identifier mismatch: expected ${expected}, got ${actual}`, 'PAYMENT_IDENTIFIER_MISMATCH');
  }
}

export class ReplayConflictError extends DomainError {
  constructor(identifier: string) {
    super(`Replay conflict for identifier ${identifier}: inputs do not match original`, 'REPLAY_CONFLICT');
  }
}

export class JobAlreadyAdmittedError extends DomainError {
  constructor(quoteId: string) {
    super(`Job for quote ${quoteId} has already been admitted`, 'JOB_ALREADY_ADMITTED');
  }
}
