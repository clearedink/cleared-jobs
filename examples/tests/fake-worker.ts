import {
  ExecutionId,
  startJob,
  completeJob,
  failJob,
  IClockPort,
  IStoragePort,
  JobId,
  WorkerJob
} from '@cleared/core';

/**
 * A client wrapper for workers to report their status back to the core.
 * In the demo app, this calls core services directly.
 */
export class CallbackClient {
  constructor(
    private storage: IStoragePort,
    private clock: IClockPort
  ) {}

  async startAttempt(jobId: JobId, executionId: ExecutionId) {
    await startJob({ jobId, executionId }, this.storage, this.clock);
  }

  async completeAttempt(jobId: JobId, executionId: ExecutionId, output: Record<string, any>) {
    await completeJob(
      {
        jobId,
        executionId,
        output,
      },
      this.storage,
      this.clock
    );
  }

  async failAttempt(jobId: JobId, executionId: ExecutionId, error: string) {
    await failJob(
      {
        jobId,
        executionId,
        error,
      },
      this.storage,
      this.clock
    );
  }
}

export class FakeWorker {
  constructor(private client: CallbackClient) {}

  /**
   * Simulates a deterministic batch_enrichment job
   */
  async process(job: WorkerJob): Promise<void> {
    // 1. Mark as started
    await this.client.startAttempt(job.jobId, job.executionId);

    // 2. Simulate processing delay
    const delay = job.inputs.sleep_ms || 1000;
    await new Promise(resolve => setTimeout(resolve, delay));

    // 3. Selective failure based on input flag
    if (job.inputs.force_failure === true) {
      await this.client.failAttempt(
        job.jobId,
        job.executionId,
        'Simulated failure: force_failure flag was set'
      );
      return;
    }

    // 4. Deterministic success output
    const output = {
      job_id: job.jobId,
      processed_at: new Date().toISOString(),
      enriched_data: {
        original_inputs: job.inputs,
        summary: `Successfully processed ${Object.keys(job.inputs).length} input fields`,
        status: 'high_confidence',
      },
    };

    await this.client.completeAttempt(job.jobId, job.executionId, output);
  }
}
