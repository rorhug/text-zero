import { redirect } from 'next/navigation';
import { auth } from '../../(auth)/auth';
import { InboxLayout } from '../inbox-layout';

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ chat_id: string }>;
}) {
  const session = await auth();

  if (!session) {
    redirect('/api/auth/guest');
  }

  return <InboxLayout initialChatId={(await params).chat_id} />;
}
