import { redirect } from 'next/navigation';
import { auth } from '../(auth)/auth';
import { InboxContent } from './inbox-content';

export default async function InboxPage() {
  const session = await auth();

  if (!session) {
    redirect('/api/auth/guest');
  }

  return <InboxContent />;
}