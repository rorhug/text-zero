import { NextResponse } from 'next/server';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

export async function GET() {
  try {
    // Get current commit hash
    const { stdout: currentHash } = await execAsync(
      'git rev-parse --short HEAD',
    );
    const currentCommit = currentHash.trim();

    let remoteCommit = '';

    // Try to fetch remote commit from GitHub API
    let hasUpdate = false;
    try {
      const response = await fetch(
        'https://api.github.com/repos/rorhug/text-zero/commits/main',
        {
          headers: {
            Accept: 'application/vnd.github.v3+json',
          },
          next: { revalidate: 60 }, // Cache for 60 seconds
        },
      );

      if (response.ok) {
        const data = await response.json();
        remoteCommit = data.sha.substring(0, 7); // Get short hash

        // Check if remote is ahead of current commit
        // Only show update if remote commit is different AND we're not ahead of remote
        if (currentCommit !== remoteCommit) {
          try {
            const { stdout: mergeBase } = await execAsync(
              `git merge-base ${currentCommit} ${remoteCommit}`,
            );
            const base = mergeBase.trim();

            // If merge-base equals remote commit, we are ahead (or diverged)
            // Only set hasUpdate to true if merge-base equals current commit (remote is ahead)
            hasUpdate = base === currentCommit;
          } catch {
            // If git merge-base fails (commits unrelated), show update indicator
            hasUpdate = true;
          }
        }
      }
    } catch (error) {
      // If fetch fails, just ignore the update check
      console.error('Failed to check for updates:', error);
    }

    return NextResponse.json({
      currentCommit,
      hasUpdate,
      remoteCommit,
    });
  } catch (error) {
    console.error('Failed to get version info:', error);
    return NextResponse.json(
      { error: 'Failed to get version info' },
      { status: 500 },
    );
  }
}
