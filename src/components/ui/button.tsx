import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF2D55] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent disabled:pointer-events-none disabled:opacity-45 active:scale-[0.98] cursor-pointer',
  {
    variants: {
      variant: {
        default: 'bg-[#FF2D55] text-white hover:bg-[#e6264b] shadow-sm shadow-[#FF2D55]/20',
        glass:
          'liquid-glass text-[#111216] dark:text-[#F5F5F7] hover:bg-white/85 dark:hover:bg-white/10',
        ghost:
          'text-[#48484A] dark:text-[#AEAEB2] hover:bg-black/5 dark:hover:bg-white/8 hover:text-[#111216] dark:hover:text-white',
        outline:
          'border border-black/10 dark:border-white/12 bg-transparent text-[#111216] dark:text-[#F5F5F7] hover:bg-black/5 dark:hover:bg-white/8',
        destructive: 'bg-red-600 text-white hover:bg-red-700',
      },
      size: {
        default: 'min-h-[40px] px-4 py-2',
        sm: 'min-h-[36px] px-3 py-1.5 text-xs',
        lg: 'min-h-[46px] px-6 py-2.5 text-base',
        icon: 'min-h-[44px] min-w-[44px] p-0 rounded-full',
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
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button ref={ref} className={cn(buttonVariants({ variant, size, className }))} {...props} />
  )
);
Button.displayName = 'Button';
