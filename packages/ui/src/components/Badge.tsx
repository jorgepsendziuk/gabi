import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '../lib/cn.js';

export type BadgeVariant = 'default' | 'accent' | 'warning' | 'danger' | 'info';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  children: ReactNode;
}

export function Badge({ variant = 'default', children, className, ...props }: BadgeProps) {
  return (
    <span className={cn('gabi-badge', `gabi-badge--${variant}`, className)} {...props}>
      {children}
    </span>
  );
}
