import type { InputHTMLAttributes, LabelHTMLAttributes, ReactNode } from 'react';
import { cn } from '../lib/cn.js';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  hasError?: boolean;
}

export function Input({ className, hasError, ...props }: InputProps) {
  return (
    <input
      className={cn('gabi-input', hasError && 'gabi-input--error', className)}
      {...props}
    />
  );
}

export interface LabelProps extends LabelHTMLAttributes<HTMLLabelElement> {
  children: ReactNode;
  required?: boolean;
}

export function Label({ children, required, className, ...props }: LabelProps) {
  return (
    <label className={cn('gabi-label', className)} {...props}>
      {children}
      {required && <span className="gabi-label__required"> *</span>}
    </label>
  );
}

export interface FieldProps {
  label: string;
  required?: boolean;
  error?: string;
  children: ReactNode;
  className?: string;
}

export function Field({ label, required, error, children, className }: FieldProps) {
  return (
    <div className={cn('gabi-field', className)}>
      <Label required={required}>{label}</Label>
      {children}
      {error && <p className="gabi-field__error">{error}</p>}
    </div>
  );
}
