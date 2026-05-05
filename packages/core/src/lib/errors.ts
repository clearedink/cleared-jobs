import { JobStatus } from '../domain/statuses.js';

export class DomainError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'DomainError';
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

// -----------------------------------------------------------------------------
// New Errors from README
// -----------------------------------------------------------------------------

export class MissingIdempotencyKeyError extends DomainError {
  constructor() {
    super('Missing Idempotency-Key header', 'MISSING_IDEMPOTENCY_KEY');
  }
}

export class IdempotencyConflictError extends DomainError {
  public existingInputHash: string;
  public receivedInputHash: string;
  
  constructor(existingInputHash: string, receivedInputHash: string) {
    super(`Idempotency conflict: existing hash ${existingInputHash} != received ${receivedInputHash}`, 'IDEMPOTENCY_CONFLICT');
    this.existingInputHash = existingInputHash;
    this.receivedInputHash = receivedInputHash;
  }
}

export class PaymentAlreadyAdmittedError extends DomainError {
  public paymentId: string;
  public jobId: string;
  
  constructor(paymentId: string, jobId: string) {
    super(`Payment ${paymentId} is already admitted to job ${jobId}`, 'PAYMENT_ALREADY_ADMITTED');
    this.paymentId = paymentId;
    this.jobId = jobId;
  }
}

export class JobNotFoundError extends DomainError {
  public jobId: string;
  
  constructor(jobId: string) {
    super(`Job ${jobId} not found`, 'JOB_NOT_FOUND');
    this.jobId = jobId;
  }
}

export class InvalidJobTransitionError extends DomainError {
  public jobId: string;
  public from: JobStatus;
  public to: JobStatus;
  
  constructor(jobId: string, from: JobStatus, to: JobStatus) {
    super(`Invalid job transition for ${jobId} from ${from} to ${to}`, 'INVALID_JOB_TRANSITION');
    this.jobId = jobId;
    this.from = from;
    this.to = to;
  }
}
