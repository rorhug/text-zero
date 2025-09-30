'use client';

import useSWR from 'swr';
import { fetcher } from '@/lib/utils';

interface VersionInfo {
  currentCommit: string;
  hasUpdate: boolean;
  remoteCommit: string;
}

export function VersionBadge() {
  const { data, error } = useSWR<VersionInfo>('/api/version', fetcher, {
    refreshInterval: 600000, // Check every 10 minutes
    revalidateOnFocus: false,
  });

  if (error || !data) {
    return null;
  }

  return (
    <div className="text-xs text-muted-foreground">
      {data.hasUpdate ? (
        <a
          href={`https://github.com/rorhug/text-zero/compare/${data.currentCommit}...main`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline"
        >
          git pull to update {data.remoteCommit}...{data.currentCommit}
        </a>
      ) : (
        <span className="font-mono">{data.currentCommit}</span>
      )}
    </div>
  );
}
