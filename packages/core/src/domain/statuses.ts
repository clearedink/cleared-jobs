export type JobIntentStatus =
  | 'requires_payment'
  | 'paid'
  | 'expired'
  | 'cancelled';

export type JobStatus =
  | 'admitted'
  | 'queued'
  | 'running'
  | 'completed'
  | 'failed'
  | 'manual_review'
  | 'refund_due';

export type JobFailureResolution =
  | 'retryable'
  | 'manual_review'
  | 'refund_due'
  | 'terminal_failed';
