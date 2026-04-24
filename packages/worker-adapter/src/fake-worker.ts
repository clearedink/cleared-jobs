import { WorkerJob } from '@cleared/core';
import { CallbackClient } from './callback-client';

export class FakeWorker {
  constructor(private client: CallbackClient) {}

  /**
   * Simulates a deterministic batch_enrichment job
   */
  async process(job: WorkerJob): Promise<void> {
    // 1. Mark as started
    await this.client.startAttempt(job.executionId);

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
