import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/src/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0 rounded-lg text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D99B26] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B1410] disabled:pointer-events-none disabled:opacity-45 cursor-pointer',
  {
    variants: {
      variant: {
        default:
          'bg-[#D99B26] text-[#0B1410] font-semibold hover:bg-[#E5AA38] active:bg-[#C68B1B]',
        secondary:
          'bg-[#1B3126] text-[#F4F1EA] border border-white/12 hover:bg-[#233F31]',
        outline:
          'border border-white/16 bg-transparent text-[#F4F1EA] hover:bg-white/8',
        ghost: 'text-[#C5D4CC] hover:bg-white/8 hover:text-white',
        destructive:
          'bg-[#B91C1C] text-white hover:bg-[#DC2626]',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 px-3 text-xs',
        lg: 'h-11 px-6 text-sm',
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
