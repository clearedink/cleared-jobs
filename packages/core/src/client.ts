import { IStoragePort } from './ports/storage';
import { handlePaidJobRequest } from './services/handle-paid-job-request';
import { getOrCreateJobIntent } from './services/get-or-create-job-intent';
import { admitPaidJob } from './services/admit-paid-job';
import { startJob, completeJob, failJob, getJob, getResult } from './services/job-lifecycle';
import { IClockPort } from './ports/clock';
import { SystemClock } from './ports/clock';

export interface ClearedConfig {
  storage: IStoragePort;
  clock?: IClockPort;
}

export function createCleared(config: ClearedConfig) {
  const clock = config.clock || new SystemClock();

  return {
    handlePaidJobRequest: async (input: Parameters<typeof handlePaidJobRequest>[0]) => {
      return handlePaidJobRequest(input, config.storage, clock);
    },
    getOrCreateJobIntent: async (input: Parameters<typeof getOrCreateJobIntent>[0]) => {
      return getOrCreateJobIntent(input, config.storage, clock);
    },
    admitPaidJob: async (input: Parameters<typeof admitPaidJob>[0]) => {
      return admitPaidJob(input, config.storage, clock);
    },
    startJob: async (jobId: string, input?: Parameters<typeof startJob>[1]) => {
      return startJob(jobId, input, config.storage, clock);
    },
    completeJob: async (jobId: string, input: Parameters<typeof completeJob>[1]) => {
      return completeJob(jobId, input, config.storage, clock);
    },
    failJob: async (jobId: string, input: Parameters<typeof failJob>[1]) => {
      return failJob(jobId, input, config.storage, clock);
    },
    getJob: async (jobId: string) => {
      return getJob(jobId, config.storage);
    },
    getResult: async (jobId: string) => {
      return getResult(jobId, config.storage);
    }
  };
}
