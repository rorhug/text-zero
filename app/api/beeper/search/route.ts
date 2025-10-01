import { auth } from '@/app/(auth)/auth';
import { ChatSDKError } from '@/lib/errors';
import type { NextRequest } from 'next/server';
import BeeperDesktop from '@beeper/desktop-api';

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return new ChatSDKError('unauthorized:chat').toResponse();
  }

  const accessToken = process.env.BEEPER_MCP_TOKEN;
  if (!accessToken) {
    return new ChatSDKError('unauthorized:api', 'BEEPER_MCP_TOKEN is not configured').toResponse();
  }

  try {
    const client = new BeeperDesktop({ accessToken });
    const { searchParams } = request.nextUrl;
    const q = (searchParams.get('q') || '').trim();
    if (q.length < 3) {
      return Response.json({ items: [] });
    }

    // Fetch a reasonable page and filter client-side (Desktop API search doesn't expose free-text param here)
    const page = await client.chats.search({ includeMuted: true, limit: 200, inbox: 'primary', type: 'single' });

    const query = q.toLowerCase();
    const contains = (s: string | undefined | null) => (s || '').toLowerCase().includes(query);

    // Simple fuzzy: all chars of query appear in order within candidate
    const fuzzy = (candidate: string) => {
      const c = candidate.toLowerCase();
      let i = 0;
      for (let ch of query) {
        i = c.indexOf(ch, i);
        if (i === -1) return false;
        i++;
      }
      return true;
    };

    const scored = page.items
      .map((chat) => {
        const title = chat.title || '';
        const participants = (chat.participants?.items || [])
          .map((p: any) => p.displayName || p.username || p.id)
          .filter(Boolean)
          .join(' ');
        const hay = `${title} ${participants}`.trim();

        const isContains = contains(hay);
        const isFuzzy = !isContains && fuzzy(hay);
        const score = isContains ? 2 : isFuzzy ? 1 : 0;
        return { chat, score };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score);

    const items = scored.slice(0, 20).map(({ chat }) => ({
      id: chat.id,
      localChatID: (chat as any).localChatID,
      title: chat.title || 'Unknown',
      unreadCount: chat.unreadCount || 0,
      lastActivity: chat.lastActivity || null,
      participants: chat.participants?.items?.map((p: any) => ({
        displayName: p.displayName,
        username: p.username,
        id: p.id,
      })) || [],
    }));

    return Response.json({ items });
  } catch (error) {
    console.error('Error searching Beeper chats:', error);
    return new ChatSDKError('server_error:api', 'Failed to search chats').toResponse();
  }
}


