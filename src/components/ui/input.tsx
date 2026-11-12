import * as React from 'react';
import { cn } from '@/src/lib/utils';

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'flex h-12 w-full rounded-lg border border-[#869696] bg-white px-4 py-2 text-base text-[#1C2B2B] placeholder:text-[#6D7D7D] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#007272] focus-visible:border-[#007272] disabled:cursor-not-allowed disabled:bg-[#F2F4EC] disabled:opacity-60',
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';
