import React, { useRef, useState } from 'react';
import { ExternalLink, FolderOpen, Link2, Music2, Smartphone, Upload } from 'lucide-react';
import { useLibrary } from '../../app/LibraryContext';
import { isNativeMediaStoreAvailable } from '../../plugins/mediaStore';
import { isWebFileSystemAccessSupported } from '../../services/libraryService';
import { cn } from '../../lib/utils';
import { GlassButton } from '../../components/glass/GlassButton';
import { GlassCard } from '../../components/glass/GlassCard';

interface ImportDropzoneProps {
  compact?: boolean;
  onImported?: () => void;
}

export const ImportDropzone: React.FC<ImportDropzoneProps> = ({
  compact = false,
  onImported,
}) => {
  const {
    importFiles,
    pickAndImportAudioFiles,
    pickAndLinkOriginalFiles,
    pickAndLinkOriginalFolder,
    scanDeviceMediaStore,
    isScanningMediaStore,
    importProgress,
  } = useLibrary();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [iframeBlockedNotice, setIframeBlockedNotice] = useState(false);
  const hasNativeMediaStore = isNativeMediaStoreAvailable();
  const canLinkOriginalWeb = !hasNativeMediaStore && isWebFileSystemAccessSupported();

  const handleFiles = async (fileList: FileList | null) => {
    if (hasNativeMediaStore) {
      const imported = await pickAndImportAudioFiles();
      if (imported.length > 0) onImported?.();
      return;
    }
    if (!fileList || fileList.length === 0) return;
    await importFiles(fileList);
    onImported?.();
  };

  const handleAndroidPicker = async () => {
    const imported = await pickAndImportAudioFiles();
    if (imported.length > 0) onImported?.();
  };

  const handleMediaStoreScan = async () => {
    await scanDeviceMediaStore();
    onImported?.();
  };

  const handleLinkOriginalFiles = async () => {
    setIframeBlockedNotice(false);
    const res = await pickAndLinkOriginalFiles();
    if (res.iframeBlocked) {
      setIframeBlockedNotice(true);
      return;
    }
    if (res.tracks.length > 0) onImported?.();
  };

  const handleLinkOriginalFolder = async () => {
    setIframeBlockedNotice(false);
    const res = await pickAndLinkOriginalFolder();
    if (res.iframeBlocked) {
      setIframeBlockedNotice(true);
      return;
    }
    if (res.tracks.length > 0) onImported?.();
  };

  return (
    <GlassCard
      onDragOver={(e) => {
        e.preventDefault();
        setDragActive(true);
      }}
      onDragLeave={() => setDragActive(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragActive(false);
        void handleFiles(e.dataTransfer.files);
      }}
      className={cn(
        'transition-all duration-200',
        compact ? 'p-4' : 'p-8 sm:p-10 text-center',
        dragActive && 'ring-2 ring-[#FF2D55] bg-[#FF2D55]/8'
      )}
    >
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="audio/*,.mp3,.m4a,.aac,.wav,.ogg,.flac,.opus"
        onChange={(e) => {
          void handleFiles(e.target.files);
          e.target.value = '';
        }}
        className="hidden"
      />
      <input
        ref={folderInputRef}
        type="file"
        multiple
        webkitdirectory=""
        onChange={(e) => {
          void handleFiles(e.target.files);
          e.target.value = '';
        }}
        className="hidden"
      />

      {importProgress.active ? (
        <div className="space-y-3 py-2 max-w-md mx-auto">
          <p className="text-sm font-semibold">
            Importing {importProgress.done + 1} of {importProgress.total}
          </p>
          <p className="text-xs text-[#6E6E73] dark:text-[#98989D] truncate">
            {importProgress.currentFile}
          </p>
          <div className="h-2 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
            <div
              className="h-full bg-[#FF2D55] transition-all duration-200"
              style={{
                width: `${Math.round(((importProgress.done + 0.5) / Math.max(1, importProgress.total)) * 100)}%`,
              }}
            />
          </div>
        </div>
      ) : compact ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-2xl bg-[#FF2D55]/12 text-[#FF2D55] flex items-center justify-center shrink-0">
                <Music2 className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate">Import local audio</p>
                <p className="text-xs text-[#6E6E73] dark:text-[#98989D] truncate">
                  MP3, M4A, AAC, WAV, OGG, FLAC ·{' '}
                  {hasNativeMediaStore
                    ? 'Pick files to allow embedded tag editing'
                    : canLinkOriginalWeb
                      ? 'Link original disk files (no copy) to edit tags in place'
                      : 'Stored offline in the app'}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {hasNativeMediaStore && (
                <GlassButton
                  size="sm"
                  variant="accent"
                  disabled={isScanningMediaStore}
                  onClick={() => void handleMediaStoreScan()}
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>{isScanningMediaStore ? 'Scanning...' : 'Scan Device'}</span>
                </GlassButton>
              )}
              {canLinkOriginalWeb ? (
                <>
                  <GlassButton
                    size="sm"
                    variant="accent"
                    onClick={() => void handleLinkOriginalFiles()}
                  >
                    <Link2 className="w-3.5 h-3.5" />
                    <span>Link Original Files</span>
                  </GlassButton>
                  <GlassButton size="sm" onClick={() => void handleLinkOriginalFolder()}>
                    <FolderOpen className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Link Folder</span>
                  </GlassButton>
                  <GlassButton
                    size="sm"
                    variant="ghost"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Copy Files</span>
                  </GlassButton>
                </>
              ) : (
                <>
                  <GlassButton
                    size="sm"
                    variant={hasNativeMediaStore ? 'glass' : 'accent'}
                    onClick={() =>
                      hasNativeMediaStore
                        ? void handleAndroidPicker()
                        : fileInputRef.current?.click()
                    }
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>{hasNativeMediaStore ? 'Pick Editable Files' : 'Add Files'}</span>
                  </GlassButton>
                  {!hasNativeMediaStore && (
                    <GlassButton size="sm" onClick={() => folderInputRef.current?.click()}>
                      <FolderOpen className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Folder</span>
                    </GlassButton>
                  )}
                </>
              )}
            </div>
          </div>
          {iframeBlockedNotice && <IframeLinkNotice onCopyFallback={() => fileInputRef.current?.click()} />}
        </div>
      ) : (
        <div className="max-w-lg mx-auto">
          <div className="w-14 h-14 rounded-3xl bg-[#FF2D55]/12 text-[#FF2D55] flex items-center justify-center mx-auto mb-4">
            <Music2 className="w-7 h-7" strokeWidth={1.8} />
          </div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight font-display">
            Your music, completely offline
          </h2>
          <p className="text-sm text-[#6E6E73] dark:text-[#98989D] mt-2 leading-relaxed">
            Link or import tracks from your phone or computer. Neo Player reads and edits embedded tags and artwork locally — nothing is ever uploaded.
          </p>
          <p className="text-xs text-[#8E8E93] mt-2">
            Supports MP3, M4A, AAC, WAV, OGG, and FLAC
          </p>
          <p className="text-xs text-[#8E8E93] mt-1">
            {hasNativeMediaStore
              ? 'Use the Android picker to keep write access for editing the original file tags.'
              : canLinkOriginalWeb
                ? 'Link Original Files plays straight from disk with zero duplicate copy and writes MP3, M4A/MP4, FLAC, & WAV tag edits directly to the original file.'
                : 'Select music files to import into your offline library.'}
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3 mt-6">
            {hasNativeMediaStore && (
              <GlassButton
                size="lg"
                variant="accent"
                disabled={isScanningMediaStore}
                onClick={() => void handleMediaStoreScan()}
              >
                <Smartphone className="w-4 h-4" />
                <span>{isScanningMediaStore ? 'Scanning Device...' : 'Scan Device Music'}</span>
              </GlassButton>
            )}
            {canLinkOriginalWeb ? (
              <>
                <GlassButton
                  size="lg"
                  variant="accent"
                  onClick={() => void handleLinkOriginalFiles()}
                >
                  <Link2 className="w-4 h-4" />
                  <span>Link Original Files</span>
                </GlassButton>
                <GlassButton size="lg" onClick={() => void handleLinkOriginalFolder()}>
                  <FolderOpen className="w-4 h-4" />
                  <span>Link Music Folder</span>
                </GlassButton>
                <GlassButton
                  size="sm"
                  variant="ghost"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Copy Into Browser</span>
                </GlassButton>
              </>
            ) : (
              <>
                <GlassButton
                  size="lg"
                  variant={hasNativeMediaStore ? 'glass' : 'accent'}
                  onClick={() =>
                    hasNativeMediaStore
                      ? void handleAndroidPicker()
                      : fileInputRef.current?.click()
                  }
                >
                  <Upload className="w-4 h-4" />
                  <span>{hasNativeMediaStore ? 'Pick Editable Music Files' : 'Select Music Files'}</span>
                </GlassButton>
                {!hasNativeMediaStore && (
                  <GlassButton size="lg" onClick={() => folderInputRef.current?.click()}>
                    <FolderOpen className="w-4 h-4" />
                    <span>Import Folder</span>
                  </GlassButton>
                )}
              </>
            )}
          </div>

          {iframeBlockedNotice && (
            <div className="mt-4 text-left">
              <IframeLinkNotice onCopyFallback={() => fileInputRef.current?.click()} />
            </div>
          )}
        </div>
      )}
    </GlassCard>
  );
};

const IframeLinkNotice: React.FC<{ onCopyFallback: () => void }> = ({ onCopyFallback }) => {
  const currentUrl = typeof window !== 'undefined' ? window.location.href : '/';
  return (
    <div className="rounded-2xl liquid-glass-subtle p-3.5 text-xs flex flex-wrap items-center justify-between gap-3">
      <p className="text-[#48484A] dark:text-[#AEAEB2] flex-1 min-w-[200px]">
        Direct disk linking is restricted inside an embedded preview frame. Open Neo Player in its own tab to edit original files without copying, or copy files into the browser instead.
      </p>
      <div className="flex items-center gap-2 shrink-0">
        <a
          href={currentUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 min-h-[34px] px-3 rounded-xl bg-[var(--neo-accent)] text-white font-semibold hover:brightness-110 transition-all"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          <span>Open in New Tab</span>
        </a>
        <GlassButton size="sm" onClick={onCopyFallback}>
          Copy Instead
        </GlassButton>
      </div>
    </div>
  );
};
