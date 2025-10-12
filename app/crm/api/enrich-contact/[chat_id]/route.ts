import { auth } from '@/app/(auth)/auth';
import { ChatSDKError } from '@/lib/errors';
import BeeperDesktop from '@beeper/desktop-api';
import { generateObject } from 'ai';
import type { NextRequest } from 'next/server';
import { myProvider } from '@/lib/ai/providers';
import { z } from 'zod';
import { db } from '@/lib/db/queries';
import { BeeperChat, beeperChat } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { DEFAULT_CHAT_MODEL } from '@/lib/ai/models';

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

  const chatId = (await params).chat_id;

  // Save or update BeeperChat information
  const [beeperChatStored] = await db
    .insert(beeperChat)
    .values({
      chatId,
      name: '',
      summary: '',
      interests: [],
      notes: '',
      lastMessage: null,
      updatedAt: new Date(),
      createdAt: new Date(),
    })
    .returning()
    .onConflictDoUpdate({
      target: [beeperChat.chatId],
      set: {
        updatedAt: new Date(),
      },
    });

  if (!beeperChatStored) {
    return new ChatSDKError(
      'bad_request:database',
      'Failed to store BeeperChat',
    ).toResponse();
  }

  try {
    const client = new BeeperDesktop({
      accessToken,
    });

    // Get recent messages for context
    const messagesPage = await client.messages.search({
      chatIDs: [chatId, chatId],
      limit: 30,
    });

    const messages = messagesPage.items.reverse();

    // Format messages for the AI prompt with timestamps
    const now = new Date();
    const conversationHistory = messages
      .map((msg) => {
        const sender = msg.isSender ? 'You' : msg.senderName || 'Other';
        const timestamp = new Date(msg.timestamp);
        const diffInHours =
          (now.getTime() - timestamp.getTime()) / (1000 * 60 * 60);

        let timeAgo: string;
        if (diffInHours < 1) {
          const diffInMinutes = Math.floor(diffInHours * 60);
          timeAgo = diffInMinutes <= 1 ? 'just now' : `${diffInMinutes}m ago`;
        } else if (diffInHours < 24) {
          timeAgo = `${Math.floor(diffInHours)}h ago`;
        } else {
          const diffInDays = Math.floor(diffInHours / 24);
          timeAgo = `${diffInDays}d ago`;
        }

        return `[${timeAgo}] ${sender}: ${msg.text || '[no text]'}`;
      })
      .join('\n');

    console.log(conversationHistory);

    const prompt = `Based on this conversation history with timestamps, analyze the conversation and provide structured information.

The conversation shows when each message was sent relative to now. Recent messages (within hours) are much more relevant than older ones.

Conversation history (most recent at bottom):
${conversationHistory}

---END OF CONVERSATION HISTORY---

Analyze the conversation and provide:
1. A brief summary of the conversation so far (2-3 sentences)
2. Key interests or topics discussed by the other person (as an array of tags)
3. Any important context or notes about this relationship`;

    const schema = z.object({
      summary: z
        .string()
        .describe('A brief summary of the conversation (2-3 sentences)'),
      interests: z
        .array(z.string())
        .describe('Key interests or topics as an array of tags'),
      notes: z
        .string()
        .describe('Important context or notes about this relationship'),
    });

    const result = await generateObject({
      model: myProvider.languageModel(DEFAULT_CHAT_MODEL),
      schema,
      prompt,
    });

    // Get chat info for the contact name
    const chatInfo = await client.chats.retrieve({ chatID: chatId });
    const contactName = chatInfo.title || 'Unknown';

    // Get last message metadata
    const lastMsg = messages[messages.length - 1];
    const lastMessage = lastMsg
      ? {
          id: lastMsg.id,
          timestamp: lastMsg.timestamp,
          text: lastMsg.text || '',
          isSender: lastMsg.isSender ?? false,
        }
      : null;

    await db
      .update(beeperChat)
      .set({
        summary: result.object.summary,
        interests: result.object.interests,
        notes: result.object.notes,
        lastMessage,
        updatedAt: new Date(),
      })
      .where(eq(beeperChat.chatId, chatId));

    return Response.json({
      success: true,
      summary: result.object.summary,
      interests: result.object.interests,
      notes: result.object.notes,
    });
  } catch (error) {
    console.error('Error enriching contact:', error);
    return new ChatSDKError(
      'server_error:api',
      'Failed to enrich contact',
    ).toResponse();
  }
}
