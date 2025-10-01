import { auth } from '@/app/(auth)/auth';
import { ChatSDKError } from '@/lib/errors';
import BeeperDesktop from '@beeper/desktop-api';
import { generateText } from 'ai';
import { DEFAULT_CHAT_MODEL } from '@/lib/ai/models';
import type { NextRequest } from 'next/server';
import { myProvider } from '@/lib/ai/providers';

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

    const chatId = (await params).chat_id;

    // Get recent messages for context
    const messagesPage = await client.messages.search({
      chatIDs: [chatId, chatId], // Using the workaround for the array API issue
      limit: 30,
    });

    const messages = messagesPage.items.reverse(); // Oldest first

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

    const prompt = `Based on this conversation history with timestamps, suggest a natural and appropriate response. Pay special attention to the timing of messages - more recent messages should heavily influence your response. Consider the conversation flow and respond appropriately to the most recent context.

The conversation shows when each message was sent relative to now. Recent messages (within hours) are much more relevant than older ones.

Conversation history (most recent at bottom):
${conversationHistory}

---END OF CONVERSATION HISTORY---

Provide a suggested response that:
1. Responds to the most recent message context
2. Matches the conversation tone and style
3. Is natural and conversational. Do not use emdash i.e. —
4. Only provide the message text, nothing else

Suggested response:`;

    const result = await generateText({
      model: myProvider.languageModel('complete-chat'),
      prompt,
      // maxOutputTokens: 512,
      providerOptions: {
        openai: {
          reasoning: { effort: 'minimal' },
        },
      },
    });

    return Response.json({
      suggestion: result.text.trim().replaceAll('—', ' - '),
    });
  } catch (error) {
    console.error('Error generating suggestion:', error);
    return new ChatSDKError(
      'server_error:api',
      'Failed to generate message suggestion',
    ).toResponse();
  }
}
