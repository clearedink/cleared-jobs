import {
  startJob,
  completeJob,
  failJob,
  IClockPort,
  IStoragePort,
  JobId,
  JobRecord
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

  async startAttempt(jobId: JobId, workerId: string) {
    await startJob(jobId, { workerId }, this.storage, this.clock);
  }

  async completeAttempt(jobId: JobId, result: Record<string, any>) {
    await completeJob(
      jobId,
      {
        result,
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
  async process(job: { id: JobId; inputs: Record<string, any>; executionId: string }): Promise<void> {
    // 1. Mark as started
    await this.client.startAttempt(job.id, job.executionId);

    // 2. Simulate processing delay
    const delay = (job.inputs as any).sleep_ms || 1000;
    await new Promise(resolve => setTimeout(resolve, delay));

    // 3. Selective failure based on input flag
    if ((job.inputs as any).force_failure === true) {
      await this.client.failAttempt(
        job.id,
        'Simulated failure: force_failure flag was set'
      );
      return;
    }

    // 4. Deterministic success output
    const output = {
      job_id: job.id,
      processed_at: new Date().toISOString(),
      enriched_data: {
        original_inputs: job.inputs,
        summary: `Successfully processed ${Object.keys(job.inputs).length} input fields`,
        status: 'high_confidence',
      },
    };

    await this.client.completeAttempt(job.id, output);
  }
}
