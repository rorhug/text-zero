import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { getUserSettings } from '@/lib/db/queries';

export async function GET(
  request: NextRequest,
  { params }: { params: { chat_id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const settings = await getUserSettings({ userId: session.user.id });
    const afterMessageAction = settings?.afterMessageAction || 'stay';
    const archiveAction = (settings as any)?.archiveAction || 'next_conversation';

    return NextResponse.json({ afterMessageAction, archiveAction });
  } catch (error) {
    console.error('Error getting after message action:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
