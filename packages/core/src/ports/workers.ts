import { Job } from '../domain/models';
import { JobId, ExecutionId } from '../domain/ids';

export interface WorkerJob {
  jobId: JobId;
  executionId: ExecutionId;
  templateId: string;
  inputs: Record<string, any>;
}

export interface WorkerResult {
  jobId: JobId;
  executionId: ExecutionId;
  output: Record<string, any>;
  status: 'SUCCESS' | 'FAILURE';
  error?: string;
}

export interface IWorkerPort {
  /**
   * Dispatch a job to a worker
   */
  dispatch(job: WorkerJob): Promise<void>;

  /**
   * Cancel a running job
   */
  cancel(jobId: JobId): Promise<void>;
}

export interface IWorkerCallback {
  /**
   * Handle completion of a job from a worker
   */
  onComplete(result: WorkerResult): Promise<void>;
}
