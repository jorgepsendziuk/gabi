import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '../lib/cn.js';

export type AlertVariant = 'info' | 'success' | 'warning' | 'danger';

export interface AlertProps extends HTMLAttributes<HTMLDivElement> {
  variant?: AlertVariant;
  children: ReactNode;
}

export function Alert({ variant = 'info', children, className, ...props }: AlertProps) {
  return (
    <div className={cn('gabi-alert', `gabi-alert--${variant}`, className)} role="alert" {...props}>
      {children}
    </div>
  );
}
