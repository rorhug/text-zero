import { redirect } from 'next/navigation';
import { auth } from '../(auth)/auth';
import { InboxLayout } from './inbox-layout';

export default async function InboxPage() {
  const session = await auth();

  if (!session) {
    redirect('/api/auth/guest');
  }

  return <InboxLayout />;
}