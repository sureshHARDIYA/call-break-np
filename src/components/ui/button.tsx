import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/src/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0 rounded-lg text-base font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#007272] focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:pointer-events-none disabled:opacity-45 cursor-pointer',
  {
    variants: {
      variant: {
        default:
          'bg-[#007272] text-white hover:bg-[#005A5A] active:bg-[#004646]',
        secondary:
          'bg-white text-[#007272] border border-[#007272] hover:bg-[#E8F6F2] active:bg-[#D5EFE8]',
        outline:
          'border border-[#D3DCDC] bg-white text-[#1C2B2B] hover:bg-[#F2F4EC] hover:border-[#869696]',
        ghost:
          'text-[#334343] hover:bg-[#E8F6F2] hover:text-[#004646]',
        destructive:
          'bg-[#C81E1E] text-white hover:bg-[#A61717]',
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
