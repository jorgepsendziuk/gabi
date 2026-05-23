import type { Request, Response, NextFunction } from 'express';
import { GabiError } from '@gabi/core';

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof GabiError) {
    res.status(err.statusCode).json({ error: err.message, code: err.code });
    return;
  }
  console.error(err);
  res.status(500).json({ error: 'Erro interno do servidor' });
}
