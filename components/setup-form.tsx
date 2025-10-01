'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Button } from './ui/button';

export function SetupForm({
  hasBeeperToken,
  hasOpenaiKey,
  defaultBeeperToken,
  defaultOpenaiKey,
}: {
  hasBeeperToken: boolean;
  hasOpenaiKey: boolean;
  defaultBeeperToken?: string;
  defaultOpenaiKey?: string;
}) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    const formData = new FormData(e.currentTarget);
    const beeperToken = formData.get('beeperToken') as string;
    const openaiKey = formData.get('openaiKey') as string;

    try {
      const response = await fetch('/api/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ beeperToken, openaiKey }),
      });

      if (!response.ok) {
        throw new Error('Failed to save tokens');
      }

      router.push('/inbox');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save tokens');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="beeperToken">Beeper MCP Token</Label>
        <Input
          id="beeperToken"
          name="beeperToken"
          type="text"
          placeholder="your_beeper_mcp_token_here"
          required={!hasBeeperToken}
          autoFocus
          className="bg-muted"
          defaultValue={defaultBeeperToken}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="openaiKey">OpenAI API Key</Label>
        <Input
          id="openaiKey"
          name="openaiKey"
          type="text"
          placeholder="sk-..."
          required={!hasOpenaiKey}
          className="bg-muted"
          defaultValue={defaultOpenaiKey}
        />
      </div>

      {error && (
        <p className="text-sm text-red-500">{error}</p>
      )}

      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? 'Saving...' : 'Continue'}
      </Button>
    </form>
  );
}
