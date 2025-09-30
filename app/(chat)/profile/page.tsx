import { auth } from '@/app/(auth)/auth';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { getUserSettings } from '@/lib/db/queries';
import { ProfileForm } from './profile-form';

async function PromptSettings() {
  const session = await auth();
  if (!session?.user) {
    return null;
  }

  let settings: Awaited<ReturnType<typeof getUserSettings>> = null;
  try {
    settings = await getUserSettings({ userId: session.user.id });
  } catch {
    // If user doesn't exist in DB, just return null (no settings yet)
    settings = null;
  }

  return (
    <ProfileForm settings={settings} />
  );
}

export default function Page() {
  return (
    <div className="container mx-auto py-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Profile Settings</h1>
        <Suspense fallback={<div>Loading settings...</div>}>
          <PromptSettings />
        </Suspense>
      </div>
    </div>
  );
}