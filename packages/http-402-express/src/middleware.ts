import { Request, Response, NextFunction } from 'express';
import * as responses from './responses';

/**
 * Middleware that attaches Cleared helper methods to the Express response object
 */
export function clearedMiddleware(req: Request, res: Response, next: NextFunction) {
  // We can't easily extend the Response type globally without ambient declarations,
  // but we can provide the middleware for users to use the functions directly.
  // Alternatively, we just export the functions (which we do in responses.ts).
  next();
}

/**
 * Example error handler for DomainErrors
 */
export function clearedErrorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  if (err.name === 'DomainError') {
    return responses.sendError(res, 400, err.code, err.message);
  }
  
  if (err.code === 'QUOTE_EXPIRED') {
    return responses.sendError(res, 402, 'QUOTE_EXPIRED', err.message);
  }

  next(err);
}
