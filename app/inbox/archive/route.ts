import { auth } from '@/app/(auth)/auth';
import { ChatSDKError } from '@/lib/errors';
import BeeperDesktop from '@beeper/desktop-api';
import type { NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
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

    const { chatId, archived = true } = await request.json();

    if (!chatId || typeof chatId !== 'string') {
      return new ChatSDKError(
        'bad_request:api',
        'Chat ID is required'
      ).toResponse();
    }

    const response = await client.chats.archive({
      chatID: chatId,
      archived,
    });

    return Response.json({
      success: response.success,
      chatId,
      archived,
    });
  } catch (error) {
    console.error('Error archiving conversation:', error);
    return new ChatSDKError(
      'server_error:api',
      'Failed to archive conversation'
    ).toResponse();
  }
}