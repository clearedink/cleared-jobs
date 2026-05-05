import { JobFailureResolution } from '../domain/statuses.js';

export type StartJobInput = {
  workerId?: string;
  metadata?: Record<string, unknown>;
};

export type CompleteJobInput = {
  result: Record<string, unknown>;
  resultType?: string;
  metadata?: Record<string, unknown>;
};

export type FailJobInput = {
  reason: string;
  resolution: JobFailureResolution;
  errorCode?: string;
  metadata?: Record<string, unknown>;
};
