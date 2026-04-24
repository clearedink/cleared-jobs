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

export class QuoteExpiredError extends DomainError {
  constructor(quoteId: string) {
    super(`Quote ${quoteId} has expired`, 'QUOTE_EXPIRED');
  }
}

export class PaymentVerificationFailedError extends DomainError {
  constructor(paymentId: string) {
    super(`Payment ${paymentId} could not be verified`, 'PAYMENT_VERIFICATION_FAILED');
  }
}

export class JobAlreadyAdmittedError extends DomainError {
  constructor(quoteId: string) {
    super(`Job for quote ${quoteId} has already been admitted`, 'JOB_ALREADY_ADMITTED');
  }
}
