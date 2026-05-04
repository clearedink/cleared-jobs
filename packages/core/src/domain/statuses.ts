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

// Kept for internal engine state if needed
export type EscrowState =
  | 'not_funded'
  | 'held'
  | 'release_pending'
  | 'released'
  | 'refund_pending'
  | 'refunded';

export type ResolutionState =
  | 'pending'
  | 'success'
  | 'refund_pending'
  | 'refunded'
  | 'manual_review';

export type AttemptStatus =
  | 'queued'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'timed_out'
  | 'aborted';
