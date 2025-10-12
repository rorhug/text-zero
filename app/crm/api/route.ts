import { auth } from '@/app/(auth)/auth';
import { ChatSDKError } from '@/lib/errors';
import { db } from '@/lib/db/queries';
import { beeperChat } from '@/lib/db/schema';
import { desc } from 'drizzle-orm';

export async function GET() {
  const session = await auth();

  if (!session?.user) {
    return new ChatSDKError('unauthorized:chat').toResponse();
  }

  try {
    const contacts = await db
      .select()
      .from(beeperChat)
      .orderBy(desc(beeperChat.updatedAt));

    return Response.json({ contacts });
  } catch (error) {
    console.error('Error fetching contacts:', error);
    return new ChatSDKError(
      'server_error:api',
      'Failed to fetch contacts',
    ).toResponse();
  }
}
