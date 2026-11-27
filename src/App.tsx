import React from 'react';
import { AppShell } from './app/AppShell';
import { DiscoveryProvider } from './app/DiscoveryContext';
import { LibraryProvider } from './app/LibraryContext';
import { PlayerProvider } from './app/PlayerContext';
import { ThemeProvider } from './app/ThemeContext';
import { ToastProvider } from './app/ToastContext';
import { YouTubeProvider } from './app/YouTubeContext';

export default function App() {
  return (
    <ToastProvider>
      <ThemeProvider>
        <LibraryProvider>
          <YouTubeProvider>
            <PlayerProvider>
              <DiscoveryProvider>
                <AppShell />
              </DiscoveryProvider>
            </PlayerProvider>
          </YouTubeProvider>
        </LibraryProvider>
      </ThemeProvider>
    </ToastProvider>
  );
}
