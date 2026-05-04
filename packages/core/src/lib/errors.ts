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

export class PaymentIntentNotFoundError extends DomainError {
  constructor(id: string) {
    super(`Payment intent ${id} not found`, 'PAYMENT_INTENT_NOT_FOUND');
  }
}

export class PaymentIntentExpiredError extends DomainError {
  constructor(id: string) {
    super(`Payment intent ${id} has expired`, 'PAYMENT_INTENT_EXPIRED');
  }
}

export class PaymentIntentAlreadyFundedError extends DomainError {
  constructor(id: string) {
    super(`Payment intent ${id} has already been funded`, 'PAYMENT_INTENT_ALREADY_FUNDED');
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
  constructor(paymentIntentId: string) {
    super(`Job for payment intent ${paymentIntentId} has already been admitted`, 'JOB_ALREADY_ADMITTED');
  }
}
