import React, { useRef, useState } from 'react';
import {
  ArrowRight,
  ChevronLeft,
  Disc3,
  FolderPlus,
  Lock,
  Smartphone,
  Sparkles,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useLibrary } from '../../app/LibraryContext';
import { useTheme } from '../../app/ThemeContext';
import { triggerHaptic } from '../../services/androidPlatform';
import { cn } from '../../lib/utils';
import { GlassButton } from '../../components/glass/GlassButton';
import { ThemeSwitcher } from '../../components/ThemeSwitcher';

interface IntroExperienceProps {
  open: boolean;
  onComplete: () => void;
}

const TOTAL_STEPS = 3;

export const IntroExperience: React.FC<IntroExperienceProps> = ({ open, onComplete }) => {
  const { importFiles } = useLibrary();
  const { settings } = useTheme();
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const touchStartX = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!open) return null;

  const goToStep = (next: number) => {
    if (next < 0 || next >= TOTAL_STEPS) return;
    void triggerHaptic(settings.hapticFeedback, 'light');
    setDirection(next > step ? 1 : -1);
    setStep(next);
  };

  const handleFinish = () => {
    void triggerHaptic(settings.hapticFeedback, 'medium');
    setStep(0);
    onComplete();
  };

  const handleImportAndEnter = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    await importFiles(files);
    handleFinish();
  };

  return (
    <motion.div
      initial={settings.reducedMotion ? { opacity: 1 } : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      role="dialog"
      aria-modal="true"
      aria-label="Welcome to Neo Player"
      onTouchStart={(e) => {
        touchStartX.current = e.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={(e) => {
        if (touchStartX.current === null) return;
        const delta = (e.changedTouches[0]?.clientX ?? 0) - touchStartX.current;
        touchStartX.current = null;
        if (delta < -50 && step < TOTAL_STEPS - 1) goToStep(step + 1);
        else if (delta > 50 && step > 0) goToStep(step - 1);
      }}
      className="fixed inset-0 z-[70] flex flex-col justify-between overflow-hidden bg-[#F7F7FA] dark:bg-[#08090C] text-[#111216] dark:text-[#F5F5F7] px-5 sm:px-10 py-6 pt-safe pb-safe"
    >
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="audio/*,.mp3,.m4a,.aac,.wav,.ogg,.flac,.opus"
        onChange={(e) => {
          void handleImportAndEnter(e.target.files);
          e.target.value = '';
        }}
        className="hidden"
      />

      {/* Restrained Atmospheric Background */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute -top-24 left-1/2 -translate-x-1/2 w-[540px] h-[540px] rounded-full blur-[130px] transition-colors duration-700"
          style={{
            background:
              step === 0
                ? 'rgba(255, 45, 85, 0.22)'
                : step === 1
                  ? 'rgba(10, 132, 255, 0.20)'
                  : 'rgba(94, 92, 230, 0.22)',
          }}
        />
      </div>

      {/* Top Row: Back & Skip */}
      <div className="relative z-10 flex items-center justify-between max-w-2xl w-full mx-auto">
        {step > 0 ? (
          <button
            type="button"
            onClick={() => goToStep(step - 1)}
            aria-label="Previous intro step"
            className="min-h-[44px] px-3 rounded-full inline-flex items-center gap-1 text-sm font-medium text-[#6E6E73] dark:text-[#98989D] hover:text-[#111216] dark:hover:text-white cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Back</span>
          </button>
        ) : (
          <div className="min-h-[44px]" />
        )}

        <button
          type="button"
          onClick={handleFinish}
          className="min-h-[44px] px-4 rounded-full text-sm font-medium text-[#6E6E73] dark:text-[#98989D] hover:text-[#111216] dark:hover:text-white cursor-pointer"
        >
          Skip
        </button>
      </div>

      {/* Center Stage */}
      <div className="relative z-10 flex-1 flex items-center justify-center max-w-xl w-full mx-auto my-4">
        <AnimatePresence mode="wait" custom={direction}>
          {step === 0 && (
            <motion.div
              key="step-0"
              custom={direction}
              initial={settings.reducedMotion ? { opacity: 1 } : { opacity: 0, x: direction * 28 }}
              animate={{ opacity: 1, x: 0 }}
              exit={settings.reducedMotion ? { opacity: 0 } : { opacity: 0, x: direction * -28 }}
              transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
              className="w-full text-center space-y-6"
            >
              <div className="relative w-32 h-32 sm:w-36 sm:h-36 mx-auto">
                <div className="absolute inset-0 rounded-[34px] bg-gradient-to-br from-[#FF2D55]/30 to-[#5E5CE6]/30 blur-2xl" />
                <div className="relative w-full h-full liquid-glass-elevated rounded-[34px] flex items-center justify-center">
                  <Disc3
                    className="w-16 h-16 text-[#111216] dark:text-white"
                    strokeWidth={1.5}
                  />
                </div>
              </div>

              <div className="space-y-3">
                <h1 className="text-3xl sm:text-4xl font-bold tracking-tight font-display text-balance">
                  Welcome to Neo Player
                </h1>
                <p className="text-base sm:text-lg text-[#48484A] dark:text-[#AEAEB2] max-w-md mx-auto leading-relaxed">
                  Music first. Interface second. An offline-first Liquid Glass music player crafted for Android and Web.
                </p>
              </div>
            </motion.div>
          )}

          {step === 1 && (
            <motion.div
              key="step-1"
              custom={direction}
              initial={settings.reducedMotion ? { opacity: 1 } : { opacity: 0, x: direction * 28 }}
              animate={{ opacity: 1, x: 0 }}
              exit={settings.reducedMotion ? { opacity: 0 } : { opacity: 0, x: direction * -28 }}
              transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
              className="w-full space-y-6"
            >
              <div className="text-center space-y-2">
                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight font-display text-balance">
                  Built for Android & Offline Listening
                </h2>
                <p className="text-sm sm:text-base text-[#48484A] dark:text-[#AEAEB2]">
                  Everything lives on your device with zero cloud dependency.
                </p>
              </div>

              <div className="space-y-3">
                <IntroFeatureCard
                  icon={<Lock className="w-5 h-5 text-[#30D158]" />}
                  title="Private On-Device Library"
                  description="Audio files, embedded artwork, and synchronized .lrc lyrics stay strictly inside your device storage."
                />
                <IntroFeatureCard
                  icon={<Smartphone className="w-5 h-5 text-[#0A84FF]" />}
                  title="Android Thumb Ergonomics & Media Controls"
                  description="Bottom tab navigation, lockscreen Media Session controls, hardware back support, and haptic feedback."
                />
                <IntroFeatureCard
                  icon={<Sparkles className="w-5 h-5 text-[#FF2D55]" />}
                  title="Lossless & Standard Formats"
                  description="Plays MP3, M4A, AAC, WAV, OGG, and FLAC with automatic tag extraction and manual metadata editing."
                />
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step-2"
              custom={direction}
              initial={settings.reducedMotion ? { opacity: 1 } : { opacity: 0, x: direction * 28 }}
              animate={{ opacity: 1, x: 0 }}
              exit={settings.reducedMotion ? { opacity: 0 } : { opacity: 0, x: direction * -28 }}
              transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
              className="w-full text-center space-y-6"
            >
              <div className="space-y-2">
                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight font-display text-balance">
                  Make It Yours
                </h2>
                <p className="text-sm sm:text-base text-[#48484A] dark:text-[#AEAEB2]">
                  Pick your Liquid Glass theme and import your first tracks whenever you are ready.
                </p>
              </div>

              <div className="liquid-glass rounded-3xl p-6 space-y-5 max-w-md mx-auto">
                <div className="space-y-2.5">
                  <p className="text-xs font-semibold text-[#6E6E73] dark:text-[#98989D]">
                    Appearance
                  </p>
                  <div className="flex justify-center">
                    <ThemeSwitcher />
                  </div>
                </div>

                <div className="border-t border-black/8 dark:border-white/10 pt-5 space-y-3">
                  <GlassButton
                    size="lg"
                    variant="glass"
                    className="w-full"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <FolderPlus className="w-4 h-4 text-[#FF2D55]" />
                    <span>Import Music from Device</span>
                  </GlassButton>
                  <p className="text-xs text-[#6E6E73] dark:text-[#98989D]">
                    You can also import songs or folders anytime from Home or Library.
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom Dots + Primary CTA */}
      <div className="relative z-10 max-w-md w-full mx-auto space-y-5">
        <div className="flex items-center justify-center gap-2">
          {Array.from({ length: TOTAL_STEPS }).map((_, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => goToStep(idx)}
              aria-label={`Go to intro step ${idx + 1}`}
              className={cn(
                'h-2 rounded-full transition-all duration-200 cursor-pointer',
                idx === step
                  ? 'w-7 bg-[#FF2D55]'
                  : 'w-2 bg-black/15 dark:bg-white/20 hover:bg-black/30 dark:hover:bg-white/40'
              )}
            />
          ))}
        </div>

        <GlassButton
          size="lg"
          variant="accent"
          className="w-full"
          onClick={() => {
            if (step < TOTAL_STEPS - 1) goToStep(step + 1);
            else handleFinish();
          }}
        >
          <span>{step < TOTAL_STEPS - 1 ? 'Continue' : 'Start Listening'}</span>
          <ArrowRight className="w-4 h-4" />
        </GlassButton>
      </div>
    </motion.div>
  );
};

const IntroFeatureCard: React.FC<{
  icon: React.ReactNode;
  title: string;
  description: string;
}> = ({ icon, title, description }) => (
  <div className="liquid-glass rounded-2xl p-4 flex items-start gap-3.5 text-left">
    <div className="w-10 h-10 rounded-xl bg-black/[0.04] dark:bg-white/[0.08] flex items-center justify-center shrink-0">
      {icon}
    </div>
    <div className="min-w-0">
      <p className="text-sm font-semibold">{title}</p>
      <p className="text-xs text-[#6E6E73] dark:text-[#98989D] mt-0.5 leading-relaxed">
        {description}
      </p>
    </div>
  </div>
);
