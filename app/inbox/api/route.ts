import { auth } from '@/app/(auth)/auth';
import { ChatSDKError } from '@/lib/errors';
import BeeperDesktop from '@beeper/desktop-api';
import type { NextRequest } from 'next/server';
import pMap from 'p-map';
import { getUserSettings } from '@/lib/db/queries';

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
    let limit = Number.parseInt(searchParams.get('limit') || '');
    if (!limit) {
      try {
        const settings = await getUserSettings({ userId: session.user.id });
        limit = settings?.conversationsLimit ?? 10;
      } catch {
        limit = 10;
      }
    }
    const includeMuted = searchParams.get('includeMuted') === 'true';
    const sortBy = searchParams.get('sortBy') || 'lastActivity';

    const page = await client.chats.search({
      includeMuted,
      limit,
      inbox: 'primary',
      type: 'single',
    });

    // Log first chat to see available fields
    if (page.items.length > 0) {
      console.log('=== BEEPER CHAT FIELDS ===');
      console.log('Available fields:', Object.keys(page.items[0]));
      console.log('Full chat object:', JSON.stringify(page.items[0], null, 2));
      console.log('Participants:', JSON.stringify(page.items[0].participants, null, 2));
      
      // Log each participant in detail
      page.items[0].participants?.items?.forEach((participant, idx) => {
        console.log(`Participant ${idx}:`, {
          keys: Object.keys(participant),
          data: participant
        });
      });
      
      console.log('=== END BEEPER CHAT FIELDS ===');
    }

    // Extract unique platforms from all chats
    const platforms = new Set<string>();
    page.items.forEach((chat, index) => {
      // Extract platform from chat.accountID and chat.network (same logic as main processing)
      let platform = 'unknown';
      
      // First try to extract from accountID
      if (chat.accountID) {
        if (chat.accountID === 'whatsapp') platform = 'whatsapp';
        else if (chat.accountID === 'telegram') platform = 'telegram';
        else if (chat.accountID === 'instagramgo') platform = 'instagram';
        else if (chat.accountID === 'facebook') platform = 'facebook';
        else if (chat.accountID === 'signal') platform = 'signal';
        else if (chat.accountID === 'slack') platform = 'slack';
        else if (chat.accountID === 'discord') platform = 'discord';
        else if (chat.accountID === 'sms') platform = 'sms';
        else if (chat.accountID === 'imessage') platform = 'imessage';
        else if (chat.accountID === 'linkedin') platform = 'linkedin';
        else if (chat.accountID === 'googlechat') platform = 'googlechat';
        else if (chat.accountID === 'rcs') platform = 'rcs';
        else if (chat.accountID.includes('local-whatsapp')) platform = 'whatsapp';
        else if (chat.accountID.includes('local-telegram')) platform = 'telegram';
        else if (chat.accountID.includes('local-instagram')) platform = 'instagram';
        else if (chat.accountID.includes('local-facebook')) platform = 'facebook';
        else if (chat.accountID.includes('local-messenger')) platform = 'messenger';
        else if (chat.accountID.includes('local-signal')) platform = 'signal';
        else if (chat.accountID.includes('local-slack')) platform = 'slack';
        else if (chat.accountID.includes('local-discord')) platform = 'discord';
        else if (chat.accountID.includes('local-sms')) platform = 'sms';
        else if (chat.accountID.includes('local-imessage')) platform = 'imessage';
        else if (chat.accountID.includes('local-linkedin')) platform = 'linkedin';
        else if (chat.accountID.includes('local-googlechat')) platform = 'googlechat';
        else if (chat.accountID.includes('local-rcs')) platform = 'rcs';
      }
      
      // Fallback to network field if accountID didn't work
      if (platform === 'unknown' && chat.network) {
        const network = chat.network.toLowerCase();
        if (network.includes('whatsapp')) platform = 'whatsapp';
        else if (network.includes('telegram')) platform = 'telegram';
        else if (network.includes('instagram')) platform = 'instagram';
        else if (network.includes('facebook')) platform = 'facebook';
        else if (network.includes('messenger')) platform = 'messenger';
        else if (network.includes('signal')) platform = 'signal';
        else if (network.includes('slack')) platform = 'slack';
        else if (network.includes('discord')) platform = 'discord';
        else if (network.includes('sms')) platform = 'sms';
        else if (network.includes('imessage')) platform = 'imessage';
        else if (network.includes('linkedin')) platform = 'linkedin';
        else if (network.includes('google')) platform = 'googlechat';
        else if (network.includes('rcs')) platform = 'rcs';
        else if (network.includes('twitter')) platform = 'twitter';
        else if (network.includes('matrix')) platform = 'matrix';
      }
      
      // Log first few chats to debug platform detection
      if (index < 3) {
        console.log(`Chat ${index} platform detection:`, {
          accountID: chat.accountID,
          network: chat.network,
          finalPlatform: platform
        });
      }
      
      platforms.add(platform);
    });
    console.log('Available platforms:', Array.from(platforms));

    // Fetch last message and follow-up count for each chat
    const conversationsWithLastMessage = await pMap(
      page.items,
      async (chat) => {
        try {
          const messagesPage = await client.messages.search({
            chatIDs: [chat.id, chat.id], // weird bug where the api needs to see two so it sees an array
            limit: 200, // Get more messages to count follow-ups accurately
          });

          // Sort messages by timestamp to ensure chronological order
          const messages = messagesPage.items
            .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
          const lastMessage = messages[messages.length - 1] || null;

          // Find the chronologically last message from the other person (not the user)
          // We need to go through messages in chronological order to find the actual last other message
          let lastOtherMessageIndex = -1;
          for (let i = 0; i < messages.length; i++) {
            if (!messages[i].isSender) {
              lastOtherMessageIndex = i; // Keep updating until we find the chronologically last one
            }
          }

          // Count follow-ups (user messages after the last other message)
          // Use user-defined time limit for follow-up separation
          let followUpCount = 0;
          if (lastOtherMessageIndex >= 0) {
            
            // Get user settings for follow-up time limit
            const userSettings = await getUserSettings({ userId: session.user.id });
            const timeLimit = userSettings?.followUpTimeLimit || 5;
            const timeUnit = userSettings?.followUpTimeUnit || 'minutes';
            
            // Convert to milliseconds
            let timeLimitMs = timeLimit * 60000; // default to minutes
            if (timeUnit === 'hours') {
              timeLimitMs = timeLimit * 60 * 60000;
            } else if (timeUnit === 'days') {
              timeLimitMs = timeLimit * 24 * 60 * 60000;
            }
            
            
            
            let lastUserMessageTime = null;
            
            for (let i = lastOtherMessageIndex + 1; i < messages.length; i++) {
              if (messages[i].isSender) {
                const currentMessageTime = new Date(messages[i].timestamp).getTime();
                
                // Count as new follow-up if:
                // 1. It's the first user message after the other person's message
                // 2. OR there's more than the configured time limit since the last user message
                if (lastUserMessageTime === null || 
                    (currentMessageTime - lastUserMessageTime) > timeLimitMs) {
                  followUpCount++;
                }
                
                lastUserMessageTime = currentMessageTime;
              }
            }
            
          }

          // Calculate time since last other message
          let lastOtherMessageTime = null;
          if (lastOtherMessageIndex >= 0) {
            lastOtherMessageTime = messages[lastOtherMessageIndex].timestamp;
          }

          // Extract platform information from chat.accountID and chat.network
          let platform = 'unknown';
          
          // First try to extract from accountID
          if (chat.accountID) {
            if (chat.accountID === 'whatsapp') platform = 'whatsapp';
            else if (chat.accountID === 'telegram') platform = 'telegram';
            else if (chat.accountID === 'instagramgo') platform = 'instagram';
            else if (chat.accountID === 'facebook') platform = 'facebook';
            else if (chat.accountID === 'signal') platform = 'signal';
            else if (chat.accountID === 'slack') platform = 'slack';
            else if (chat.accountID === 'discord') platform = 'discord';
            else if (chat.accountID === 'sms') platform = 'sms';
            else if (chat.accountID === 'imessage') platform = 'imessage';
            else if (chat.accountID === 'linkedin') platform = 'linkedin';
            else if (chat.accountID === 'googlechat') platform = 'googlechat';
            else if (chat.accountID === 'rcs') platform = 'rcs';
            else if (chat.accountID.includes('local-whatsapp')) platform = 'whatsapp';
            else if (chat.accountID.includes('local-telegram')) platform = 'telegram';
            else if (chat.accountID.includes('local-instagram')) platform = 'instagram';
            else if (chat.accountID.includes('local-facebook')) platform = 'facebook';
            else if (chat.accountID.includes('local-messenger')) platform = 'messenger';
            else if (chat.accountID.includes('local-signal')) platform = 'signal';
            else if (chat.accountID.includes('local-slack')) platform = 'slack';
            else if (chat.accountID.includes('local-discord')) platform = 'discord';
            else if (chat.accountID.includes('local-sms')) platform = 'sms';
            else if (chat.accountID.includes('local-imessage')) platform = 'imessage';
            else if (chat.accountID.includes('local-linkedin')) platform = 'linkedin';
            else if (chat.accountID.includes('local-googlechat')) platform = 'googlechat';
            else if (chat.accountID.includes('local-rcs')) platform = 'rcs';
          }
          
          // Fallback to network field if accountID didn't work
          if (platform === 'unknown' && chat.network) {
            const network = chat.network.toLowerCase();
            if (network.includes('whatsapp')) platform = 'whatsapp';
            else if (network.includes('telegram')) platform = 'telegram';
            else if (network.includes('instagram')) platform = 'instagram';
            else if (network.includes('facebook')) platform = 'facebook';
            else if (network.includes('messenger')) platform = 'messenger';
            else if (network.includes('signal')) platform = 'signal';
            else if (network.includes('slack')) platform = 'slack';
            else if (network.includes('discord')) platform = 'discord';
            else if (network.includes('sms')) platform = 'sms';
            else if (network.includes('imessage')) platform = 'imessage';
            else if (network.includes('linkedin')) platform = 'linkedin';
            else if (network.includes('google')) platform = 'googlechat';
            else if (network.includes('rcs')) platform = 'rcs';
            else if (network.includes('twitter')) platform = 'twitter';
            else if (network.includes('matrix')) platform = 'matrix';
          }

          return {
            ...chat,
            lastMessage: lastMessage,
            isUnresponded: !lastMessage?.isSender,
            isUnread: chat.unreadCount > 0,
            followUpCount,
            lastOtherMessageTime,
            platform,
            localChatID: chat.localChatID, // Include localChatID if available
          };
        } catch (error) {
          console.error(
            `Error fetching messages for chat ${chat.id}:`,
            error,
          );
          return {
            ...chat,
            lastMessage: null,
            followUpCount: 0,
            lastOtherMessageTime: null,
            platform: 'unknown',
          };
        }
      },
      { concurrency: 10 },
    );

    // Sort conversations based on sortBy parameter
    const sortedConversations = conversationsWithLastMessage.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return (a.title || '').localeCompare(b.title || '');
        
        case 'unreadCount':
          return (b.unreadCount || 0) - (a.unreadCount || 0);
        
        case 'lastResponse':
          if (!a.lastOtherMessageTime && !b.lastOtherMessageTime) return 0;
          if (!a.lastOtherMessageTime) return 1;
          if (!b.lastOtherMessageTime) return -1;
          return new Date(a.lastOtherMessageTime).getTime() - new Date(b.lastOtherMessageTime).getTime();
        
        case 'followUpCount':
          return (b.followUpCount || 0) - (a.followUpCount || 0);
        
        case 'lastMessage':
          if (!a.lastMessage?.timestamp && !b.lastMessage?.timestamp) return 0;
          if (!a.lastMessage?.timestamp) return 1;
          if (!b.lastMessage?.timestamp) return -1;
          return new Date(b.lastMessage.timestamp).getTime() - new Date(a.lastMessage.timestamp).getTime();
        
        case 'lastActivity':
        default:
          if (!a.lastActivity && !b.lastActivity) return 0;
          if (!a.lastActivity) return 1;
          if (!b.lastActivity) return -1;
          return new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime();
      }
    });

    return Response.json({
      conversations: sortedConversations,
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
