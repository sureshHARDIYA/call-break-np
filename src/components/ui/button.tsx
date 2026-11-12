import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/src/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0 rounded-lg text-base font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ink focus-visible:ring-offset-2 focus-visible:ring-offset-canvas disabled:pointer-events-none disabled:opacity-45 cursor-pointer',
  {
    variants: {
      variant: {
        default:
          'bg-brand text-white hover:bg-brand-hover active:bg-brand-active',
        secondary:
          'bg-surface text-brand-ink border border-brand-ink hover:bg-tint active:bg-tint-strong',
        outline:
          'border border-line bg-surface text-ink hover:bg-surface-muted hover:border-line-strong',
        ghost:
          'text-ink-2 hover:bg-tint hover:text-brand-ink-strong',
        destructive:
          'bg-danger text-white hover:bg-danger-hover',
      },
      size: {
        default: 'h-11 px-5 py-2 text-base',
        sm: 'h-9 px-3.5 text-sm',
        lg: 'h-12 px-6 text-base',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';
