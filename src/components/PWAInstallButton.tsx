import React, { useState } from 'react';
import { Download, Share } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { GlassButton } from './glass/GlassButton';
import { GlassModal } from './glass/GlassModal';

export const PWAInstallButton: React.FC<{ variant?: 'compact' | 'full' }> = ({
  variant = 'compact',
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) return null;

  if (isInstallable) {
    return (
      <GlassButton
        size={variant === 'compact' ? 'sm' : 'md'}
        variant="glass"
        onClick={() => void install()}
      >
        <Download className="w-4 h-4 text-[#FF2D55]" />
        <span>Install App</span>
      </GlassButton>
    );
  }

  if (isIOS) {
    return (
      <>
        <GlassButton
          size={variant === 'compact' ? 'sm' : 'md'}
          variant="glass"
          onClick={() => setShowIOSGuide(true)}
        >
          <Download className="w-4 h-4 text-[#FF2D55]" />
          <span>Install on iOS</span>
        </GlassButton>

        <GlassModal
          open={showIOSGuide}
          onOpenChange={setShowIOSGuide}
          title="Install Neo Player on iOS"
          description="Add Neo Player to your Home Screen for standalone offline playback."
        >
          <ol className="space-y-3 text-sm text-[#48484A] dark:text-[#AEAEB2]">
            <li className="flex items-start gap-2.5">
              <span className="font-mono-tabular font-semibold text-[#FF2D55]">1.</span>
              <span>
                Tap the <Share className="inline w-4 h-4 mx-0.5 align-text-bottom" />{' '}
                <strong className="text-[#111216] dark:text-white">Share</strong> button in Safari.
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="font-mono-tabular font-semibold text-[#FF2D55]">2.</span>
              <span>
                Scroll down and select{' '}
                <strong className="text-[#111216] dark:text-white">Add to Home Screen</strong>.
              </span>
            </li>
          </ol>
          <div className="mt-5 flex justify-end">
            <GlassButton size="sm" variant="accent" onClick={() => setShowIOSGuide(false)}>
              Done
            </GlassButton>
          </div>
        </GlassModal>
      </>
    );
  }

  return null;
};
