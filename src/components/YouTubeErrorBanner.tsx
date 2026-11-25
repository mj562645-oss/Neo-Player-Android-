import React from 'react';
import { AlertTriangle, ExternalLink, RefreshCw } from 'lucide-react';
import firebaseConfig from '../../firebase-applet-config.json';
import { useYouTube } from '../app/YouTubeContext';
import { GlassButton } from './glass/GlassButton';
import { GlassCard } from './glass/GlassCard';

export const YouTubeErrorBanner: React.FC = () => {
  const { apiDisabledInfo, error, isLoadingLibrary, refreshAll } = useYouTube();

  if (!apiDisabledInfo && !error) return null;

  if (apiDisabledInfo) {
    return (
      <GlassCard className="p-4 sm:p-5 border border-amber-500/30 bg-amber-500/8 dark:bg-amber-500/10 space-y-3">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500/18 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <h3 className="text-sm font-bold tracking-tight">
              Enable YouTube Data API v3 to Sync & Search
            </h3>
            <p className="text-xs text-[#48484A] dark:text-[#AEAEB2] leading-relaxed">
              Your Google account is signed in, but{' '}
              <span className="font-semibold">YouTube Data API v3</span> is not yet enabled on
              Google Cloud project{' '}
              <span className="font-mono-tabular font-semibold">{firebaseConfig.projectId}</span>.
              Open the Cloud Console link below, click <span className="font-semibold">Enable</span>
              , then tap <span className="font-semibold">Retry Sync</span>.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 pl-12">
          <a
            href={apiDisabledInfo.activationUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 min-h-[40px] px-4 rounded-xl text-xs font-semibold bg-[var(--neo-accent)] text-white shadow-sm hover:brightness-110 transition-all"
          >
            <span>Enable YouTube Data API v3</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
          <GlassButton
            size="sm"
            disabled={isLoadingLibrary}
            onClick={() => void refreshAll()}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingLibrary ? 'animate-spin' : ''}`} />
            <span>Retry Sync</span>
          </GlassButton>
        </div>
      </GlassCard>
    );
  }

  return (
    <GlassCard className="p-4 flex flex-wrap items-center justify-between gap-3 border border-red-500/25 bg-red-500/8">
      <div className="flex items-center gap-2.5 min-w-0">
        <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
        <p className="text-xs font-medium text-red-600 dark:text-red-400 truncate">{error}</p>
      </div>
      <GlassButton
        size="sm"
        disabled={isLoadingLibrary}
        onClick={() => void refreshAll()}
      >
        <RefreshCw className={`w-3.5 h-3.5 ${isLoadingLibrary ? 'animate-spin' : ''}`} />
        <span>Retry</span>
      </GlassButton>
    </GlassCard>
  );
};
