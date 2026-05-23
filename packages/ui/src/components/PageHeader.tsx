import type { ReactNode } from 'react';
import { cn } from '../lib/cn.js';

export interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({ title, description, actions, className }: PageHeaderProps) {
  return (
    <header className={cn('gabi-page-header', className)}>
      <div>
        <h1 className="gabi-page-header__title">{title}</h1>
        {description && <p className="gabi-page-header__desc">{description}</p>}
      </div>
      {actions && <div className="gabi-page-header__actions">{actions}</div>}
    </header>
  );
}
