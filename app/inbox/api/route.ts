import { auth } from '@/app/(auth)/auth';
import { ChatSDKError } from '@/lib/errors';
import BeeperDesktop from '@beeper/desktop-api';
import type { NextRequest } from 'next/server';
import pMap from 'p-map';

export async function GET(request: NextRequest) {
  const session = await auth();

  if (!session?.user) {
    return new ChatSDKError('unauthorized:chat').toResponse();
  }

  const accessToken = process.env.BEEPER_MCP_TOKEN;
  if (!accessToken) {
    return new ChatSDKError(
      'unauthorized:api',
      'BEEPER_MCP_TOKEN is not configured',
    ).toResponse();
  }

  try {
    const client = new BeeperDesktop({
      accessToken,
    });

    const { searchParams } = request.nextUrl;
    const limit = Number.parseInt(searchParams.get('limit') || '30');
    const includeMuted = searchParams.get('includeMuted') === 'true';

    const page = await client.chats.search({
      includeMuted,
      limit,
      inbox: 'primary',
      type: 'single',
    });

    // Fetch last message for each chat
    const conversationsWithLastMessage = await pMap(
      page.items,
      async (chat) => {
        try {
          const messagesPage = await client.messages.search({
            chatIDs: [chat.id, chat.id], // weird bug where the api needs to see two so it sees an array
            limit: 1,
          });

          const lastMessage = messagesPage.items[0] || null;

          return {
            ...chat,
            lastMessage: lastMessage,
            isUnresponded: !lastMessage?.isSender,
            isUnread: chat.unreadCount > 0,
          };
        } catch (error) {
          console.error(
            `Error fetching last message for chat ${chat.id}:`,
            error,
          );
          return {
            ...chat,
            lastMessage: null,
          };
        }
      },
      { concurrency: 10 },
    );

    return Response.json({
      conversations: conversationsWithLastMessage,
      hasMore: page.hasMore || false,
    });
  } catch (error) {
    console.error('Error fetching Beeper conversations:', error);
    return new ChatSDKError(
      'unauthorized:api',
      'Failed to fetch conversations from Beeper',
    ).toResponse();
  }
}
