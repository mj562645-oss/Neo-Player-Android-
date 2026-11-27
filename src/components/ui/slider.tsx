import * as React from 'react';
import * as SliderPrimitive from '@radix-ui/react-slider';
import { cn } from '../../lib/utils';

export const Slider = React.forwardRef<
  React.ComponentRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root> & {
    trackClassName?: string;
    rangeClassName?: string;
    thumbClassName?: string;
  }
>(({ className, trackClassName, rangeClassName, thumbClassName, ...props }, ref) => (
  <SliderPrimitive.Root
    ref={ref}
    className={cn(
      'relative flex w-full touch-none select-none items-center py-3 cursor-pointer group',
      className
    )}
    {...props}
  >
    <SliderPrimitive.Track
      className={cn(
        'relative h-1.5 w-full grow overflow-hidden rounded-full bg-black/10 dark:bg-white/15 group-hover:h-2 transition-all duration-150',
        trackClassName
      )}
    >
      <SliderPrimitive.Range
        className={cn(
          'absolute h-full rounded-full bg-[#111216] dark:bg-white transition-colors',
          rangeClassName
        )}
      />
    </SliderPrimitive.Track>
    <SliderPrimitive.Thumb
      className={cn(
        'block h-3.5 w-3.5 rounded-full bg-white shadow-md ring-1 ring-black/15 transition-transform duration-150 group-hover:scale-115 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--neo-accent)]',
        thumbClassName
      )}
    />
  </SliderPrimitive.Root>
));
Slider.displayName = SliderPrimitive.Root.displayName;
