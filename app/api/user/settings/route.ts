import { NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { getUserSettings, upsertUserSettings } from '@/lib/db/queries';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const settings = await getUserSettings({ userId: session.user.id });
    return NextResponse.json(settings);
  } catch (error) {
    console.error('Error getting user settings:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    await upsertUserSettings({
      userId: session.user.id,
      suggestionPrompt: body.suggestionPrompt || null,
      followUpPrompt: body.followUpPrompt || null,
      summaryPrompt: body.summaryPrompt || null,
      messageLimit: body.messageLimit,
      suggestionsLimit: body.suggestionsLimit,
      conversationsLimit: body.conversationsLimit,
      followUpTimeLimit: body.followUpTimeLimit,
      followUpTimeUnit: body.followUpTimeUnit,
      afterMessageAction: body.afterMessageAction,
      remindTomorrowMorning: body.remindTomorrowMorning,
      remindTomorrowMidday: body.remindTomorrowMidday,
      remindTomorrowEvening: body.remindTomorrowEvening,
      dismissOnIncomingMessage: body.dismissOnIncomingMessage,
      enableSummary: body.enableSummary,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating user settings:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
