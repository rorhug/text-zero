import { auth } from '@/app/(auth)/auth';
import { redirect } from 'next/navigation';

export default async function Page() {
  const session = await auth();

  if (!session) {
    redirect('/api/auth/guest');
  }

  const displayName = session.user?.name || session.user?.email || 'User';

  return (
    <div className="p-6">
      <h1 className="font-semibold text-2xl">Profile</h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">
        Name: {displayName}
      </p>
    </div>
  );
}
