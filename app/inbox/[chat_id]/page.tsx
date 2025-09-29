import { redirect } from 'next/navigation';
import { auth } from '../../(auth)/auth';
import { ConversationView } from './conversation-view';

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ chat_id: string }>;
}) {
  const session = await auth();

  if (!session) {
    redirect('/api/auth/guest');
  }

  return <ConversationView chatId={(await params).chat_id} />;
}
