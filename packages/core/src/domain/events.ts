import { JobId, QuoteId, PaymentId, ExecutionId, ResolutionId } from './ids';
import { JobStatus, QuoteStatus, EscrowState, ResolutionState } from './statuses';

export type DomainEventType =
  | 'QUOTE_CREATED'
  | 'QUOTE_FUNDED'
  | 'JOB_ADMITTED'
  | 'JOB_DISPATCHED'
  | 'JOB_STARTED'
  | 'JOB_COMPLETED'
  | 'JOB_FAILED'
  | 'ESCROW_RELEASE_PENDING'
  | 'ESCROW_RELEASED'
  | 'ESCROW_REFUND_PENDING'
  | 'ESCROW_REFUNDED'
  | 'RESOLUTION_MANUAL_REVIEW_TRIGGERED'
  | 'OPERATOR_ACTION_TAKEN';

export interface BaseEvent {
  id: string;
  timestamp: Date;
  aggregateId: string;
}

export interface QuoteCreatedEvent extends BaseEvent {
  type: 'QUOTE_CREATED';
  quoteId: QuoteId;
}

export interface JobAdmittedEvent extends BaseEvent {
  type: 'JOB_ADMITTED';
  jobId: JobId;
  paymentIdentifier: string;
}

export interface JobCompletedEvent extends BaseEvent {
  type: 'JOB_COMPLETED';
  jobId: JobId;
  outputHash: string;
}

export interface EscrowReleasedEvent extends BaseEvent {
  type: 'ESCROW_RELEASED';
  jobId: JobId;
  paymentId: PaymentId;
}

export interface OperatorActionEvent extends BaseEvent {
  type: 'OPERATOR_ACTION_TAKEN';
  actor: string;
  action: string;
  reason: string;
}

export type DomainEvent =
  | QuoteCreatedEvent
  | JobAdmittedEvent
  | JobCompletedEvent
  | EscrowReleasedEvent
  | OperatorActionEvent;

export interface AuditLogEntry {
  id: string;
  timestamp: Date;
  action: string;
  actor: string; // 'SYSTEM', 'WORKER', or operator ID
  resourceType: 'JOB' | 'QUOTE' | 'PAYMENT' | 'RESOLUTION';
  resourceId: string;
  payload: Record<string, any>;
  metadata: {
    ipAddress?: string;
    userAgent?: string;
    correlationId?: string;
  };
}
