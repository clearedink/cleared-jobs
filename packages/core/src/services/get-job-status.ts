import { IStoragePort } from '../ports/storage';
import { GetJobStatusQuery, GetJobStatusResult } from '../use-cases/jobs';

export async function getJobStatus(
  query: GetJobStatusQuery,
  storage: IStoragePort
): Promise<GetJobStatusResult> {
  const job = await storage.getJob(query.jobId);
  if (!job) {
    throw new Error('Job not found');
  }
  return {
    jobId: job.id,
    status: job.status,
  };
}
