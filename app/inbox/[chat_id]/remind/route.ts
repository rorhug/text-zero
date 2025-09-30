import { auth } from '@/app/(auth)/auth';
import { ChatSDKError } from '@/lib/errors';
import BeeperDesktop from '@beeper/desktop-api';
import type { NextRequest } from 'next/server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ chat_id: string }> }
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

    const { remindAtMs, dismissOnIncomingMessage } = await request.json();
    const chatId = (await params).chat_id;

    if (!remindAtMs || typeof remindAtMs !== 'number') {
      return new ChatSDKError(
        'bad_request:api',
        'remindAtMs is required and must be a number',
      ).toResponse();
    }

    // Use the Beeper API to set chat reminder
    const response = await client.chats.reminders.create({
      chatID: chatId,
      reminder: {
        remindAtMs,
        dismissOnIncomingMessage: dismissOnIncomingMessage || false,
      },
    });

    return Response.json({
      success: true,
      reminder: response,
    });
  } catch (error) {
    console.error('Error setting chat reminder:', error);
    return new ChatSDKError(
      'server_error:api',
      'Failed to set chat reminder',
    ).toResponse();
  }
}
