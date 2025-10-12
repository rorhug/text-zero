'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import { FEATURES, type FeatureKey } from '@/lib/features-client';

export function SetupForm({
  hasBeeperToken,
  hasOpenaiKey,
  defaultBeeperToken,
  defaultOpenaiKey,
  initialFeatures,
}: {
  hasBeeperToken: boolean;
  hasOpenaiKey: boolean;
  defaultBeeperToken?: string;
  defaultOpenaiKey?: string;
  initialFeatures: Record<FeatureKey, boolean>;
}) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [features, setFeatures] = useState(initialFeatures);

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

  const handleFeatureToggle = async (key: FeatureKey, enabled: boolean) => {
    setFeatures((prev) => ({ ...prev, [key]: enabled }));

    try {
      await fetch('/api/features', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, enabled }),
      });
    } catch (error) {
      console.error('Failed to save feature:', error);
      // Revert on error
      setFeatures((prev) => ({ ...prev, [key]: !enabled }));
    }
  };

  return (
    <div className="space-y-6">
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

        {error && <p className="text-sm text-red-500">{error}</p>}

        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? 'Saving...' : 'Continue'}
        </Button>
      </form>

      <div className="border-t pt-4">
        <h3 className="text-sm font-medium mb-3">Features</h3>
        <div className="space-y-3">
          {Object.entries(FEATURES).map(([key, feature]) => (
            <div key={key} className="flex items-center space-x-2">
              <Checkbox
                id={key}
                checked={features[key as FeatureKey]}
                onCheckedChange={(checked) =>
                  handleFeatureToggle(key as FeatureKey, checked as boolean)
                }
              />
              <Label
                htmlFor={key}
                className="text-sm font-normal cursor-pointer"
              >
                {feature.label}
              </Label>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
