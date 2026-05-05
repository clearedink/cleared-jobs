import { JobId, JobIntentId } from './ids';

export type DomainEventType =
  | 'JOB_INTENT_CREATED'
  | 'JOB_ADMITTED'
  | 'JOB_STARTED'
  | 'JOB_COMPLETED'
  | 'JOB_FAILED';

export interface BaseEvent {
  id: string;
  timestamp: Date;
  aggregateId: string;
}

export interface JobIntentCreatedEvent extends BaseEvent {
  type: 'JOB_INTENT_CREATED';
  intentId: JobIntentId;
}

export interface JobAdmittedEvent extends BaseEvent {
  type: 'JOB_ADMITTED';
  jobId: JobId;
}

export interface JobStartedEvent extends BaseEvent {
  type: 'JOB_STARTED';
  jobId: JobId;
}

export interface JobCompletedEvent extends BaseEvent {
  type: 'JOB_COMPLETED';
  jobId: JobId;
}

export interface JobFailedEvent extends BaseEvent {
  type: 'JOB_FAILED';
  jobId: JobId;
  reason: string;
}

export type DomainEvent =
  | JobIntentCreatedEvent
  | JobAdmittedEvent
  | JobStartedEvent
  | JobCompletedEvent
  | JobFailedEvent;

export interface AuditLogEntry {
  id: string;
  timestamp: Date;
  action: string;
  actor: string;
  resourceType: 'JOB' | 'JOB_INTENT' | 'PAYMENT';
  resourceId: string;
  payload: Record<string, any>;
  metadata: Record<string, any>;
}
