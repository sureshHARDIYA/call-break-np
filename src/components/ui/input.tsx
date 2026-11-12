import * as React from 'react';
import { cn } from '@/src/lib/utils';

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'flex h-11 w-full rounded-lg border border-white/14 bg-[#0D1913] px-3.5 py-2 text-sm text-[#F4F1EA] placeholder:text-[#7D9488] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D99B26] focus-visible:border-[#D99B26] disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';
