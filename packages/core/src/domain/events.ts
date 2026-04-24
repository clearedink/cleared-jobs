import { JobId, QuoteId, PaymentId, ExecutionId } from './ids';
import { JobStatus, QuoteStatus, EscrowState } from './statuses';

export type DomainEventType =
  | 'QUOTE_CREATED'
  | 'QUOTE_ACCEPTED'
  | 'PAYMENT_RECEIVED'
  | 'JOB_ADMITTED'
  | 'JOB_STARTED'
  | 'JOB_COMPLETED'
  | 'JOB_FAILED'
  | 'ESCROW_RELEASED'
  | 'ESCROW_REFUNDED';

export interface BaseEvent {
  id: string;
  timestamp: Date;
  aggregateId: string;
}

export interface QuoteCreatedEvent extends BaseEvent {
  type: 'QUOTE_CREATED';
  quoteId: QuoteId;
}

export interface PaymentReceivedEvent extends BaseEvent {
  type: 'PAYMENT_RECEIVED';
  paymentId: PaymentId;
  quoteId: QuoteId;
}

export interface JobAdmittedEvent extends BaseEvent {
  type: 'JOB_ADMITTED';
  jobId: JobId;
  quoteId: QuoteId;
}

export interface JobCompletedEvent extends BaseEvent {
  type: 'JOB_COMPLETED';
  jobId: JobId;
  outputHash: string;
}

export type DomainEvent =
  | QuoteCreatedEvent
  | PaymentReceivedEvent
  | JobAdmittedEvent
  | JobCompletedEvent;

export interface AuditLogEntry {
  id: string;
  timestamp: Date;
  action: string;
  actor: string;
  resourceType: 'JOB' | 'QUOTE' | 'PAYMENT';
  resourceId: string;
  payload: Record<string, any>;
}
