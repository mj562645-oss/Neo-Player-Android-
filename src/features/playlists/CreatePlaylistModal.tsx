import React, { useEffect, useState } from 'react';
import { useLibrary } from '../../app/LibraryContext';
import { useTheme } from '../../app/ThemeContext';
import { GlassButton } from '../../components/glass/GlassButton';
import { GlassModal } from '../../components/glass/GlassModal';

interface CreatePlaylistModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultMoodId?: string;
  initialTrackIds?: string[];
  onCreated?: (playlistId: string) => void;
}

export const CreatePlaylistModal: React.FC<CreatePlaylistModalProps> = ({
  open,
  onOpenChange,
  defaultMoodId,
  initialTrackIds,
  onCreated,
}) => {
  const { createPlaylist } = useLibrary();
  const { settings } = useTheme();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [moodCategoryId, setMoodCategoryId] = useState<string>(defaultMoodId || '');

  useEffect(() => {
    if (open) {
      setName('');
      setDescription('');
      setMoodCategoryId(defaultMoodId || '');
    }
  }, [open, defaultMoodId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const pl = await createPlaylist({
      name: name.trim(),
      description: description.trim(),
      moodCategoryId: moodCategoryId || undefined,
      initialTrackIds,
    });
    onOpenChange(false);
    onCreated?.(pl.id);
  };

  return (
    <GlassModal
      open={open}
      onOpenChange={onOpenChange}
      title="New Playlist"
      description={
        initialTrackIds && initialTrackIds.length > 0
          ? `Includes ${initialTrackIds.length} selected ${initialTrackIds.length === 1 ? 'track' : 'tracks'}.`
          : 'Organise your local tracks into a custom playlist or mood mix.'
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block">
          <span className="block text-xs font-medium text-[#6E6E73] dark:text-[#98989D] mb-1">
            Playlist Name
          </span>
          <input
            type="text"
            required
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Midnight Drive"
            className="w-full min-h-[42px] px-3.5 rounded-xl liquid-glass-subtle text-sm text-[#111216] dark:text-[#F5F5F7] focus:outline-none focus:ring-2 focus:ring-[#FF2D55]"
          />
        </label>

        <label className="block">
          <span className="block text-xs font-medium text-[#6E6E73] dark:text-[#98989D] mb-1">
            Description (optional)
          </span>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Atmospheric tracks for after midnight"
            className="w-full min-h-[42px] px-3.5 rounded-xl liquid-glass-subtle text-sm text-[#111216] dark:text-[#F5F5F7] focus:outline-none focus:ring-2 focus:ring-[#FF2D55]"
          />
        </label>

        <label className="block">
          <span className="block text-xs font-medium text-[#6E6E73] dark:text-[#98989D] mb-1">
            Mood Category (optional)
          </span>
          <select
            value={moodCategoryId}
            onChange={(e) => setMoodCategoryId(e.target.value)}
            className="w-full min-h-[42px] px-3.5 rounded-xl liquid-glass-subtle text-sm text-[#111216] dark:text-[#F5F5F7] focus:outline-none focus:ring-2 focus:ring-[#FF2D55] cursor-pointer"
          >
            <option value="">None</option>
            {settings.moodCategories.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>

        <div className="flex justify-end gap-2 pt-2">
          <GlassButton variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </GlassButton>
          <GlassButton type="submit" variant="accent" disabled={!name.trim()}>
            Create Playlist
          </GlassButton>
        </div>
      </form>
    </GlassModal>
  );
};
