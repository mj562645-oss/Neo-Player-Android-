import React, { useRef, useState } from 'react';
import { FolderOpen, Music2, Smartphone, Upload } from 'lucide-react';
import { useLibrary } from '../../app/LibraryContext';
import { isNativeMediaStoreAvailable } from '../../plugins/mediaStore';
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
  const { importFiles, scanDeviceMediaStore, isScanningMediaStore, importProgress } = useLibrary();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const hasNativeMediaStore = isNativeMediaStoreAvailable();

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    await importFiles(fileList);
    onImported?.();
  };

  const handleMediaStoreScan = async () => {
    await scanDeviceMediaStore();
    onImported?.();
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
        // @ts-expect-error webkitdirectory is supported on Chromium/Android/Safari desktop
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
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-[#FF2D55]/12 text-[#FF2D55] flex items-center justify-center shrink-0">
              <Music2 className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">Import local audio</p>
              <p className="text-xs text-[#6E6E73] dark:text-[#98989D] truncate">
                MP3, M4A, AAC, WAV, OGG, FLAC · Stored offline on your device
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
            <GlassButton
              size="sm"
              variant={hasNativeMediaStore ? 'glass' : 'accent'}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Add Files</span>
            </GlassButton>
            <GlassButton size="sm" onClick={() => folderInputRef.current?.click()}>
              <FolderOpen className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Folder</span>
            </GlassButton>
          </div>
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
            Import tracks from your phone or computer. Neo Player reads embedded tags and artwork locally — nothing is ever uploaded.
          </p>
          <p className="text-xs text-[#8E8E93] mt-2">
            Supports MP3, M4A, AAC, WAV, OGG, and FLAC
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
            <GlassButton
              size="lg"
              variant={hasNativeMediaStore ? 'glass' : 'accent'}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="w-4 h-4" />
              <span>Select Music Files</span>
            </GlassButton>
            <GlassButton size="lg" onClick={() => folderInputRef.current?.click()}>
              <FolderOpen className="w-4 h-4" />
              <span>Import Folder</span>
            </GlassButton>
          </div>
        </div>
      )}
    </GlassCard>
  );
};
