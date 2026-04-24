import { Response } from 'express';
import { CreateQuoteResult } from '@cleared/core';

/**
 * Sends a 402 Payment Required response with the quote/challenge details
 */
export function sendPaymentRequired(res: Response, quoteResult: CreateQuoteResult) {
  return res.status(402).json({
    error: 'PAYMENT_REQUIRED',
    message: 'Payment is required to process this request.',
    ...quoteResult
  });
}

/**
 * Sends a 202 Accepted response for a job being processed
 */
export function sendJobAccepted(res: Response, jobId: string, replayed: boolean = false) {
  return res.status(202).json({
    status: 'ACCEPTED',
    jobId,
    replayed,
    pollUrl: `/jobs/${jobId}/status`
  });
}

/**
 * Formats a successful job result response
 */
export function sendJobResult(res: Response, result: any) {
  return res.status(200).json({
    status: 'COMPLETED',
    ...result
  });
}

/**
 * Sends a standard error response
 */
export function sendError(res: Response, status: number, code: string, message: string) {
  return res.status(status).json({
    error: code,
    message
  });
}
