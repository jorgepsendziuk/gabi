import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { GabiError } from '@gabi/core';

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof GabiError) {
    res.status(err.statusCode).json({ error: err.message, code: err.code });
    return;
  }
  if (err instanceof ZodError) {
    const first = err.issues[0];
    const path = first?.path.join('.') ?? 'query';
    const msg = first?.message ?? 'Parâmetros inválidos';
    res.status(400).json({ error: `${path}: ${msg}`, code: 'VALIDATION_ERROR' });
    return;
  }
  console.error(err);
  const pgCode =
    err && typeof err === 'object' && 'code' in err ? String((err as { code: string }).code) : '';
  const detail =
    err instanceof Error
      ? err.message
      : typeof err === 'string'
        ? err
        : 'Erro interno do servidor';
  const isDev = process.env.NODE_ENV !== 'production';
  const hint =
    pgCode === '42703' || detail.includes('geo_source') || detail.includes('module_id')
      ? ' Rode pnpm db:supabase:apply (ou scripts/supabase/08_geo_source.sql e 09_gabi_module.sql).'
      : '';
  res.status(500).json({
    error: isDev ? `${detail}${hint}` : 'Erro interno do servidor',
    ...(isDev && pgCode ? { code: pgCode } : {}),
  });
}
