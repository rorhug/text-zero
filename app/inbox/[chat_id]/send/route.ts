import { auth } from '@/app/(auth)/auth';
import { ChatSDKError } from '@/lib/errors';
import BeeperDesktop from '@beeper/desktop-api';
import type { NextRequest } from 'next/server';

export async function POST(
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

    const { text } = await request.json();
    const chatId = (await params).chat_id;

    if (!text || typeof text !== 'string') {
      return new ChatSDKError(
        'bad_request:api',
        'Message text is required',
      ).toResponse();
    }

    const response = await client.messages.send({
      chatID: chatId,
      text,
    });

    return Response.json({
      success: true,
      messageId: response.pendingMessageID,
    });
  } catch (error) {
    console.error('Error sending message:', error);
    return new ChatSDKError(
      'server_error:api',
      'Failed to send message to Beeper',
    ).toResponse();
  }
}
