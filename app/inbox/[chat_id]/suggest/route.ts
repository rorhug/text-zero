import { auth } from '@/app/(auth)/auth';
import { ChatSDKError } from '@/lib/errors';
import BeeperDesktop from '@beeper/desktop-api';
import { generateText } from 'ai';
import { DEFAULT_CHAT_MODEL } from '@/lib/ai/models';
import type { NextRequest } from 'next/server';
import { myProvider } from '@/lib/ai/providers';
import { getUserSettings } from '@/lib/db/queries';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ chat_id: string }> },
) {
  const session = await auth();
  // Respect UI decision to avoid mismatches: client sends whether UI shows follow-up
  let clientIsFollowUp = false;
  try {
    const body = await request.json().catch(() => ({} as any));
    clientIsFollowUp = Boolean(body?.isFollowUpUI);
  } catch {}

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

    // Get user settings for message limit
    let messageLimit = 30;
    try {
      const settings = await getUserSettings({ userId: session.user.id });
      if (settings?.messageLimit) {
        messageLimit = settings.messageLimit;
      }
    } catch {
      // Use default if settings can't be loaded
    }

    // Get user settings for suggestions count (1-5)
    let suggestionsLimit = 3;
    try {
      const settings = await getUserSettings({ userId: session.user.id });
      if (settings?.suggestionsLimit) {
        suggestionsLimit = Math.min(5, Math.max(1, settings.suggestionsLimit));
      }
    } catch {}

    // Get chat information for context
    let chatTitle = 'Unknown Chat';
    try {
      const chatPage = await client.chats.search({
        limit: 200, // Get all chats to find the one we need
        inbox: 'primary',
        type: 'single',
      });
      const currentChat = chatPage.items.find(chat => chat.id === chatId);
      if (currentChat) {
        chatTitle = currentChat.title || 'Unknown Chat';
      }
    } catch (error) {
      console.log('Could not fetch chat title:', error);
    }

    // Get recent messages for context
    const messagesPage = await client.messages.search({
      chatIDs: [chatId, chatId], // Using the workaround for the array API issue
      limit: messageLimit,
    });

    const messages = messagesPage.items.reverse(); // Oldest first

    // Format messages for the AI prompt with timestamps
    const now = new Date();
    const conversationHistory = messages
      .map((msg) => {
        const sender = msg.isSender ? 'Me' : msg.senderName || 'Other';
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

    // Get user settings for prompts and summary
    let systemPrompt = '';
    let summaryPrompt = '';
    let followUpPrompt = '';
    let enableSummary = false;
    let followUpTimeLimit = 5;
    let followUpTimeUnit: 'minutes' | 'hours' | 'days' = 'minutes';
    try {
      const settings = await getUserSettings({ userId: session.user.id });
      systemPrompt = settings?.suggestionPrompt || 'You are a smart messaging assistant that helps with optimal communication timing and content. Consider the conversation context, timing of messages, and suggest the best responses. Pay attention to:\n\n1. Message timing - when is the optimal time to respond (immediate, wait a bit, or delay)\n2. Content quality - natural, engaging responses that match the conversation tone\n3. Context awareness - understand the conversation flow and respond appropriately\n\nAlways suggest full sentences, not just words. Consider if a quick response, delayed response, or follow-up later would be most effective. Max 5 suggestions.';
      summaryPrompt = settings?.summaryPrompt || 'Provide a brief 1-2 sentence summary of the conversation context and current situation. Focus on the key points and what needs to be addressed next.';
      followUpPrompt = settings?.followUpPrompt || '';
      enableSummary = settings?.enableSummary === 1;
      if (typeof settings?.followUpTimeLimit === 'number') {
        followUpTimeLimit = settings.followUpTimeLimit;
      }
      if (typeof settings?.followUpTimeUnit === 'string') {
        const unit = settings.followUpTimeUnit as 'minutes' | 'hours' | 'days';
        followUpTimeUnit = unit || 'minutes';
      }
    } catch {
      systemPrompt = 'You are a smart messaging assistant that helps with optimal communication timing and content. Consider the conversation context, timing of messages, and suggest the best responses. Pay attention to:\n\n1. Message timing - when is the optimal time to respond (immediate, wait a bit, or delay)\n2. Content quality - natural, engaging responses that match the conversation tone\n3. Context awareness - understand the conversation flow and respond appropriately\n\nAlways suggest full sentences, not just words. Consider if a quick response, delayed response, or follow-up later would be most effective. Max 5 suggestions.';
      summaryPrompt = 'Provide a brief 1-2 sentence summary of the conversation context and current situation. Focus on the key points and what needs to be addressed next.';
      followUpPrompt = '';
      enableSummary = false;
      followUpTimeLimit = 5;
      followUpTimeUnit = 'minutes';
    }

    // Determine follow-up situation: server check (last message sent by user)
    const isFollowUpServer = messages.length > 0 && !!messages[messages.length - 1]?.isSender;

    // Additional guard: only consider follow-up if enough time has passed since user's last message
    let timeLimitMsForFollowUp = followUpTimeLimit * 60000;
    if (followUpTimeUnit === 'hours') timeLimitMsForFollowUp = followUpTimeLimit * 60 * 60000;
    else if (followUpTimeUnit === 'days') timeLimitMsForFollowUp = followUpTimeLimit * 24 * 60 * 60000;

    let includeByTiming = false;
    if (isFollowUpServer) {
      const lastMsg = messages[messages.length - 1];
      const lastUserTime = new Date(lastMsg.timestamp).getTime();
      includeByTiming = Date.now() - lastUserTime > timeLimitMsForFollowUp;
    }

    // (Optional) diagnostics for understanding mismatches
    try {
      let lastOtherMessageIndex = -1;
      for (let i = 0; i < messages.length; i++) {
        if (!messages[i].isSender) lastOtherMessageIndex = i;
      }
      let followUpCount = 0;
      if (lastOtherMessageIndex >= 0) {
        let timeLimitMs = followUpTimeLimit * 60000;
        if (followUpTimeUnit === 'hours') timeLimitMs = followUpTimeLimit * 60 * 60000;
        else if (followUpTimeUnit === 'days') timeLimitMs = followUpTimeLimit * 24 * 60 * 60000;
        let lastUserMessageTime: number | null = null;
        for (let i = lastOtherMessageIndex + 1; i < messages.length; i++) {
          if (messages[i].isSender) {
            const t = new Date(messages[i].timestamp).getTime();
            if (lastUserMessageTime === null || t - lastUserMessageTime > timeLimitMs) {
              followUpCount++;
            }
            lastUserMessageTime = t;
          }
        }
      }
      console.log('[SUGGEST] Follow-up diagnostics:', {
        clientIsFollowUp,
        isFollowUpServer,
        followUpTimeLimit,
        followUpTimeUnit,
        messagesCount: messages.length,
      });
    } catch {}

    // Final inclusion: only if UI says follow-up AND server agrees AND timing gate passes
    const includeFollowUpGuidance = Boolean(
      followUpPrompt && clientIsFollowUp && isFollowUpServer && includeByTiming,
    );

    const prompt = `${includeFollowUpGuidance ? followUpPrompt : systemPrompt}

Chat User Name: ${chatTitle}
Current time: ${now.toLocaleString()}

Based on this conversation history with timestamps, suggest ${suggestionsLimit} natural and appropriate responses. Pay special attention to the timing of messages - more recent messages should heavily influence your response. Consider the conversation flow and respond appropriately to the most recent context.

The conversation shows when each message was sent relative to now. Recent messages (within hours) are much more relevant than older ones.

Conversation history (most recent at bottom):
${conversationHistory}

---END OF CONVERSATION HISTORY---

Provide exactly ${suggestionsLimit} alternative suggested responses that:
1. Respond to the most recent message context
2. Match the conversation tone and style
3. Are natural and conversational

IMPORTANT: You must respond with a valid JSON object in this exact format:
{
  "summary": "${enableSummary ? summaryPrompt : 'No summary needed'}",
  "suggestion1": "Your first suggestion here",
  "suggestion2": "Your second suggestion here",
  "suggestion3": "Your third suggestion here"
}

${enableSummary ? `The summary should follow this instruction: ${summaryPrompt}` : 'Set summary to empty string if summary is disabled.'} Do not include any other text, explanations, or formatting outside the JSON object.`;

    // Log what we're sending to OpenAI
    console.log('=== OPENAI REQUEST ===');
    console.log('System Prompt:', systemPrompt);
    console.log('Full Prompt:', prompt);
    console.log('Model:', 'complete-chat');
    console.log('Suggestions Limit:', suggestionsLimit);
    console.log('Enable Summary:', enableSummary);
    console.log('Summary Prompt:', summaryPrompt);
    console.log('Follow-up Prompt:', followUpPrompt);
    console.log('Is Follow-up UI:', clientIsFollowUp);
    console.log('Is Follow-up Server (last message from user):', isFollowUpServer);
    console.log('Follow-up Timing Gate (since last user msg > limit):', includeByTiming);
    console.log('Include Follow-up Guidance:', includeFollowUpGuidance);
    console.log('=== END OPENAI REQUEST ===');

    const result = await generateText({
      model: myProvider.languageModel('complete-chat'),
      prompt,
      // maxOutputTokens: 512,
      providerOptions: {
        openai: {
          reasoning: { effort: 'minimal' },
          response_format: { type: 'json_object' },
        },
      },
    });

    // Log OpenAI response
    console.log('=== OPENAI RESPONSE ===');
    console.log('Raw Response:', result.text);
    console.log('Response Length:', result.text.length);
    console.log('=== END OPENAI RESPONSE ===');

    try {
      // Clean the response text - remove markdown code blocks if present
      let cleanedText = result.text.trim();
      
      // Remove ```json and ``` markers
      if (cleanedText.startsWith('```json')) {
        cleanedText = cleanedText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanedText.startsWith('```')) {
        cleanedText = cleanedText.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      
      
      
      // Try to parse JSON response
      const jsonResponse = JSON.parse(cleanedText);
      const suggestions: string[] = [];
      const summary = jsonResponse.summary || '';
      
      console.log('=== PARSED JSON RESPONSE ===');
      console.log('Parsed JSON:', jsonResponse);
      console.log('Summary:', summary);
      console.log('Enable Summary:', enableSummary);
      console.log('=== END PARSED JSON RESPONSE ===');
      
      // Extract suggestions from JSON object
      for (let i = 1; i <= suggestionsLimit; i++) {
        const key = `suggestion${i}`;
        if (jsonResponse[key]) {
          suggestions.push(jsonResponse[key]);
        }
      }
      
      console.log('=== EXTRACTED SUGGESTIONS ===');
      console.log('Suggestions:', suggestions);
      console.log('Final Summary:', enableSummary ? summary : '');
      console.log('=== END EXTRACTED SUGGESTIONS ===');
      
      if (suggestions.length > 0) {
        return Response.json({ suggestions, summary: enableSummary ? summary : '' });
      }
    } catch (jsonError) {
      console.log('=== JSON PARSING ERROR ===');
      console.log('Failed to parse JSON response, falling back to text parsing:', jsonError);
      console.log('Raw text that failed to parse:', result.text);
      console.log('=== END JSON PARSING ERROR ===');
    }

    // Fallback: if JSON parsing fails, try the old text parsing method
    const lines = result.text
      .split('\n')
      .map((l) => l.trim().replace(/^[-*]\s*/, ''))
      .filter((l) => l.length > 0);

    const suggestions = lines.slice(0, suggestionsLimit);

    // Fallback: if model returned a single paragraph, cut into up to N sentences
    if (suggestions.length === 0 && result.text.trim().length > 0) {
      const fallback = result.text
        .split(/[\n\.]/)
        .map((l) => l.trim())
        .filter((l) => l.length > 0)
        .slice(0, suggestionsLimit);
      return Response.json({ suggestions: fallback, summary: enableSummary ? '' : '' });
    }

    return Response.json({ suggestions, summary: enableSummary ? '' : '' });
  } catch (error) {
    console.error('Error generating suggestion:', error);
    return new ChatSDKError(
      'server_error:api',
      'Failed to generate message suggestion',
    ).toResponse();
  }
}
