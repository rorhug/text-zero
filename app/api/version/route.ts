import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function GET() {
  try {
    // Get current commit hash
    const { stdout: currentHash } = await execAsync(
      'git rev-parse --short HEAD',
    );
    const currentCommit = currentHash.trim();

    // Try to fetch remote and compare
    let hasUpdate = false;
    try {
      // Fetch remote without updating local refs
      await execAsync('git fetch origin main --dry-run 2>&1', {
        timeout: 5000,
      });

      // Get remote commit hash
      const { stdout: remoteHash } = await execAsync(
        'git rev-parse --short origin/main',
      );
      const remoteCommit = remoteHash.trim();

      hasUpdate = currentCommit !== remoteCommit;
    } catch (error) {
      // If fetch fails, just ignore the update check
      console.error('Failed to check for updates:', error);
    }

    return NextResponse.json({
      currentCommit,
      hasUpdate,
    });
  } catch (error) {
    console.error('Failed to get version info:', error);
    return NextResponse.json(
      { error: 'Failed to get version info' },
      { status: 500 },
    );
  }
}
