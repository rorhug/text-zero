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
      messageLimit: body.messageLimit,
      suggestionsLimit: body.suggestionsLimit,
      conversationsLimit: body.conversationsLimit,
      followUpTimeLimit: body.followUpTimeLimit,
      followUpTimeUnit: body.followUpTimeUnit,
      afterMessageAction: body.afterMessageAction,
      remind5min: body.remind5min,
      remind30min: body.remind30min,
      remind1h: body.remind1h,
      remind3h: body.remind3h,
      remindTomorrowMorning: body.remindTomorrowMorning,
      remindTomorrowMidday: body.remindTomorrowMidday,
      remindTomorrowEvening: body.remindTomorrowEvening,
      remind3days: body.remind3days,
      remind7days: body.remind7days,
      dismissOnIncomingMessage: body.dismissOnIncomingMessage,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating user settings:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
