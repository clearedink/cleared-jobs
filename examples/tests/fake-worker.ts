import {
  startJob,
  completeJob,
  failJob,
  IClockPort,
  IStoragePort,
  JobId
} from '@cleared/core';

export interface WorkerJob {
  jobId: string;
  executionId: string;
  inputs: any;
}

/**
 * A client wrapper for workers to report their status back to the core.
 * In the demo app, this calls core services directly.
 */
export class CallbackClient {
  constructor(
    private storage: IStoragePort,
    private clock: IClockPort
  ) {}

  async startAttempt(jobId: JobId, executionId: string) {
    await startJob(jobId, { workerId: executionId }, this.storage, this.clock);
  }

  async completeAttempt(jobId: JobId, output: Record<string, any>) {
    await completeJob(
      jobId,
      {
        result: output,
      },
      this.storage,
      this.clock
    );
  }

  async failAttempt(jobId: JobId, error: string) {
    await failJob(
      jobId,
      {
        reason: error,
        resolution: 'manual_review',
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
    await this.client.startAttempt(job.jobId as JobId, job.executionId);

    // 2. Simulate processing delay
    const delay = job.inputs.sleep_ms || 1000;
    await new Promise(resolve => setTimeout(resolve, delay));

    // 3. Selective failure based on input flag
    if (job.inputs.force_failure === true) {
      await this.client.failAttempt(
        job.jobId as JobId,
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

    await this.client.completeAttempt(job.jobId as JobId, output);
  }
}
