'use client';

import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { fetcher } from '@/lib/utils';

interface VersionInfo {
  currentCommit: string;
  hasUpdate: boolean;
}

export function VersionBadge() {
  const { data, error } = useSWR<VersionInfo>('/api/version', fetcher, {
    refreshInterval: 60000, // Check every minute
    revalidateOnFocus: false,
  });

  if (error || !data) {
    return null;
  }

  return (
    <div className="text-xs text-muted-foreground">
      {data.hasUpdate ? (
        <a
          href="https://github.com/rorhug/text-zero"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline"
        >
          Update - git pull
        </a>
      ) : (
        <span className="font-mono">{data.currentCommit}</span>
      )}
    </div>
  );
}
