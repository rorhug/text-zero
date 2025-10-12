import { SetupForm } from '@/components/setup-form';
import { getAllFeatures } from '@/lib/features';

export default async function SetupPage() {
  const beeperToken = process.env.BEEPER_MCP_TOKEN;
  const openaiKey = process.env.OPENAI_API_KEY;
  const features = await getAllFeatures();

  // If both tokens are already set, redirect to inbox
  // if (beeperToken && openaiKey) {
  //   redirect('/inbox');
  // }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-bold">Setup Required</h1>
          <p className="text-muted-foreground">
            Please provide your API tokens to continue
          </p>
        </div>
        <SetupForm
          hasBeeperToken={!!beeperToken}
          hasOpenaiKey={!!openaiKey}
          defaultBeeperToken={beeperToken}
          defaultOpenaiKey={openaiKey}
          initialFeatures={features}
        />
      </div>
    </div>
  );
}
