import { IStoragePort } from '../ports/storage';
import { GetJobResultQuery, GetJobResultResult } from '../use-cases/jobs';

export async function getJobResult(
  query: GetJobResultQuery,
  storage: IStoragePort
): Promise<GetJobResultResult> {
  const result = await storage.getResult(query.jobId);
  return {
    jobId: query.jobId,
    result: result || undefined,
  };
}
