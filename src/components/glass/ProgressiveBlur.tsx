import React from 'react';
import { cn } from '../../lib/utils';

interface ProgressiveBlurProps {
  position: 'top' | 'bottom';
  className?: string;
  maxBlurPx?: number;
}

/**
 * Multi-band CSS progressive blur curtain using staggered backdrop-filter layers
 * and linear mask-image gradients so scrolling content dissolves organically.
 */
export const ProgressiveBlur: React.FC<ProgressiveBlurProps> = ({
  position,
  className,
  maxBlurPx = 22,
}) => {
  const isTop = position === 'top';
  const dir = isTop ? 'to top' : 'to bottom';
  const layers = [
    { blur: Math.round(maxBlurPx * 0.14), start: '0%', end: '100%' },
    { blur: Math.round(maxBlurPx * 0.34), start: '24%', end: '100%' },
    { blur: Math.round(maxBlurPx * 0.62), start: '48%', end: '100%' },
    { blur: maxBlurPx, start: '70%', end: '100%' },
  ];

  return (
    <div
      aria-hidden="true"
      className={cn(
        'pointer-events-none fixed left-0 right-0 z-20',
        isTop ? 'top-0 h-16' : 'bottom-0 h-28',
        className
      )}
    >
      {layers.map((layer, idx) => {
        const mask = `linear-gradient(${dir}, rgba(0,0,0,0) ${layer.start}, rgba(0,0,0,1) ${layer.end})`;
        return (
          <div
            key={idx}
            className="absolute inset-0"
            style={{
              backdropFilter: `blur(${layer.blur}px)`,
              WebkitBackdropFilter: `blur(${layer.blur}px)`,
              maskImage: mask,
              WebkitMaskImage: mask,
            }}
          />
        );
      })}
    </div>
  );
};
