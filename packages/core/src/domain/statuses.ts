export enum JobIntentStatus {
  OPEN = 'open',
  FUNDED = 'funded',
  EXPIRED = 'expired',
  CANCELLED = 'cancelled',
}

export enum JobStatus {
  ADMITTED = 'admitted',
  QUEUED = 'queued',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  MANUAL_REVIEW = 'manual_review',
  REFUND_DUE = 'refund_due',
}

export enum EscrowState {
  NOT_FUNDED = 'not_funded',
  HELD = 'held',
  RELEASE_PENDING = 'release_pending',
  RELEASED = 'released',
  REFUND_PENDING = 'refund_pending',
  REFUNDED = 'refunded',
}

export enum ResolutionState {
  PENDING = 'pending',
  SUCCESS = 'success',
  REFUND_PENDING = 'refund_pending',
  REFUNDED = 'refunded',
  MANUAL_REVIEW = 'manual_review',
}

export enum AttemptStatus {
  QUEUED = 'queued',
  RUNNING = 'running',
  SUCCEEDED = 'succeeded',
  FAILED = 'failed',
  TIMED_OUT = 'timed_out',
  ABORTED = 'aborted',
}
