import {
  ExecutionId,
  handleWorkerCallback,
  handleWorkerStart,
  IClockPort,
  IPaymentPort,
  IStoragePort,
  JobId,
} from '@cleared/core';

/**
 * A client wrapper for workers to report their status back to the core.
 * In the demo app, this calls core services directly.
 */
export class CallbackClient {
  constructor(
    private storage: IStoragePort,
    private payments: IPaymentPort,
    private clock: IClockPort
  ) {}

  async startAttempt(executionId: ExecutionId) {
    await handleWorkerStart(executionId, this.storage, this.clock);
  }

  async completeAttempt(jobId: JobId, executionId: ExecutionId, output: Record<string, any>) {
    await handleWorkerCallback(
      {
        jobId,
        executionId,
        status: 'SUCCESS',
        output,
      },
      this.storage,
      this.payments,
      this.clock
    );
  }

  async failAttempt(jobId: JobId, executionId: ExecutionId, error: string) {
    await handleWorkerCallback(
      {
        jobId,
        executionId,
        status: 'FAILURE',
        output: {},
        error,
      },
      this.storage,
      this.payments,
      this.clock
    );
  }
}
