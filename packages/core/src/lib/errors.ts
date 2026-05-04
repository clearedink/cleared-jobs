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

export class JobIntentNotFoundError extends DomainError {
  constructor(id: string) {
    super(`Job intent ${id} not found`, 'JOB_INTENT_NOT_FOUND');
  }
}

export class JobIntentExpiredError extends DomainError {
  constructor(id: string) {
    super(`Job intent ${id} has expired`, 'JOB_INTENT_EXPIRED');
  }
}

export class JobIntentAlreadyFundedError extends DomainError {
  constructor(id: string) {
    super(`Job intent ${id} has already been funded`, 'JOB_INTENT_ALREADY_FUNDED');
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
  constructor(jobIntentId: string) {
    super(`Job for job intent ${jobIntentId} has already been admitted`, 'JOB_ALREADY_ADMITTED');
  }
}
