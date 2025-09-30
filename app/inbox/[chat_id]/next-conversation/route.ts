import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import BeeperDesktop from '@beeper/desktop-api';
import { getUserSettings } from '@/lib/db/queries';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ chat_id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { chat_id } = await params;
    const { searchParams } = new URL(request.url);
    const filter = searchParams.get('filter') || 'unresponded';
    const sortBy = searchParams.get('sortBy') || 'lastActivity';
    const platform = searchParams.get('platform') || 'all';

    const accessToken = process.env.BEEPER_MCP_TOKEN;
    if (!accessToken) {
      return NextResponse.json({ error: 'BEEPER_MCP_TOKEN not configured' }, { status: 500 });
    }

    const client = new BeeperDesktop({
      accessToken,
    });
    
    // Get user settings for conversations limit
    const settings = await getUserSettings({ userId: session.user.id });
    const conversationsLimit = settings?.conversationsLimit || 10;

    // Get conversations with same filters as inbox
    const page = await client.chats.search({
      limit: conversationsLimit,
      inbox: 'primary',
      type: 'single',
    });

    // Filter conversations based on the current filter and platform
    const filteredConversations = page.items.filter((chat) => {
      // Apply conversation filter
      if (filter === 'unresponded') {
        if (!(chat.unreadCount > 0)) return false;
      } else if (filter === 'noAnswer') {
        // For noAnswer, we need to check if user sent last message
        // This is simplified - in real implementation you'd need to check messages
        if (chat.unreadCount > 0) return false; // If unread, other person sent last message
      }
      
      // Apply platform filter
      if (platform !== 'all') {
        let chatPlatform = 'unknown';
        if (chat.accountID) {
          if (chat.accountID === 'whatsapp') chatPlatform = 'whatsapp';
          else if (chat.accountID === 'telegram') chatPlatform = 'telegram';
          else if (chat.accountID === 'instagramgo') chatPlatform = 'instagram';
          else if (chat.accountID === 'facebook') chatPlatform = 'facebook';
          else if (chat.accountID === 'signal') chatPlatform = 'signal';
          else if (chat.accountID === 'slack') chatPlatform = 'slack';
          else if (chat.accountID === 'discord') chatPlatform = 'discord';
          else if (chat.accountID === 'sms') chatPlatform = 'sms';
          else if (chat.accountID === 'imessage') chatPlatform = 'imessage';
          else if (chat.accountID === 'linkedin') chatPlatform = 'linkedin';
          else if (chat.accountID === 'googlechat') chatPlatform = 'googlechat';
          else if (chat.accountID === 'rcs') chatPlatform = 'rcs';
          else if (chat.accountID.includes('local-whatsapp')) chatPlatform = 'whatsapp';
          else if (chat.accountID.includes('local-telegram')) chatPlatform = 'telegram';
          else if (chat.accountID.includes('local-instagram')) chatPlatform = 'instagram';
          else if (chat.accountID.includes('local-facebook')) chatPlatform = 'facebook';
          else if (chat.accountID.includes('local-messenger')) chatPlatform = 'messenger';
          else if (chat.accountID.includes('local-signal')) chatPlatform = 'signal';
          else if (chat.accountID.includes('local-slack')) chatPlatform = 'slack';
          else if (chat.accountID.includes('local-discord')) chatPlatform = 'discord';
          else if (chat.accountID.includes('local-sms')) chatPlatform = 'sms';
          else if (chat.accountID.includes('local-imessage')) chatPlatform = 'imessage';
          else if (chat.accountID.includes('local-linkedin')) chatPlatform = 'linkedin';
          else if (chat.accountID.includes('local-googlechat')) chatPlatform = 'googlechat';
          else if (chat.accountID.includes('local-rcs')) chatPlatform = 'rcs';
        }
        
        // Fallback to network field if accountID didn't work
        if (chatPlatform === 'unknown' && chat.network) {
          const network = chat.network.toLowerCase();
          if (network.includes('whatsapp')) chatPlatform = 'whatsapp';
          else if (network.includes('telegram')) chatPlatform = 'telegram';
          else if (network.includes('instagram')) chatPlatform = 'instagram';
          else if (network.includes('facebook')) chatPlatform = 'facebook';
          else if (network.includes('messenger')) chatPlatform = 'messenger';
          else if (network.includes('signal')) chatPlatform = 'signal';
          else if (network.includes('slack')) chatPlatform = 'slack';
          else if (network.includes('discord')) chatPlatform = 'discord';
          else if (network.includes('sms')) chatPlatform = 'sms';
          else if (network.includes('imessage')) chatPlatform = 'imessage';
          else if (network.includes('linkedin')) chatPlatform = 'linkedin';
          else if (network.includes('google')) chatPlatform = 'googlechat';
          else if (network.includes('rcs')) chatPlatform = 'rcs';
          else if (network.includes('twitter')) chatPlatform = 'twitter';
          else if (network.includes('matrix')) chatPlatform = 'matrix';
        }
        
        if (chatPlatform !== platform) return false;
      }
      
      return true;
    });

    // Find current conversation index
    const currentIndex = filteredConversations.findIndex(chat => chat.id === chat_id);
    
    // Get next conversation
    let nextConversation = null;
    if (currentIndex >= 0 && currentIndex < filteredConversations.length - 1) {
      nextConversation = filteredConversations[currentIndex + 1];
    } else if (filteredConversations.length > 0) {
      // If at the end, go to first conversation
      nextConversation = filteredConversations[0];
    }

    if (nextConversation) {
      return NextResponse.json({ 
        nextChatId: nextConversation.id,
        hasNext: true 
      });
    } else {
      return NextResponse.json({ 
        hasNext: false 
      });
    }
  } catch (error) {
    console.error('Error getting next conversation:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}