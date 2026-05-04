import { JobId, ExecutionId } from '../domain/ids';
import { JobStatus } from '../domain/statuses';
import { JobResult } from '../domain/models';

export interface GetJobStatusQuery {
  jobId: JobId;
}

export interface GetJobStatusResult {
  jobId: JobId;
  status: JobStatus;
}

export interface GetJobResultQuery {
  jobId: JobId;
}

export interface GetJobResultResult {
  jobId: JobId;
  result?: JobResult;
}

export interface StartJobCommand {
  jobId: JobId;
  executionId?: ExecutionId;
  workerId?: string;
  metadata?: Record<string, any>;
}

export interface CompleteJobCommand {
  jobId: JobId;
  executionId?: ExecutionId;
  output: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface FailJobCommand {
  jobId: JobId;
  executionId?: ExecutionId;
  error: string;
  metadata?: Record<string, any>;
}
