import { auth } from '@/app/(auth)/auth';
import { ChatSDKError } from '@/lib/errors';
import BeeperDesktop from '@beeper/desktop-api';
import type { NextRequest } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ chat_id: string }> },
) {
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
    const awaitedParams = await params;
    const chatId = awaitedParams.chat_id;

    const messagesPage = await client.messages.search({
      chatIDs: [chatId, chatId], // Using the workaround for the array API issue
      limit,
    });

    return Response.json({
      messages: messagesPage.items, // Reverse to show oldest first
      hasMore: messagesPage.hasMore || false,
      chatId,
    });
  } catch (error) {
    console.error('Error fetching messages:', error);
    return new ChatSDKError(
      'server_error:api',
      'Failed to fetch messages from Beeper',
    ).toResponse();
  }
}
