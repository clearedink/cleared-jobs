import { JobId } from '../domain/ids';
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
