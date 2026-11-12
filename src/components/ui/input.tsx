import * as React from 'react';
import { cn } from '@/src/lib/utils';

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'flex h-12 w-full rounded-lg border border-line-strong bg-surface px-4 py-2 text-base text-ink placeholder:text-ink-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ink focus-visible:border-brand-ink disabled:cursor-not-allowed disabled:bg-surface-muted disabled:opacity-60',
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';
