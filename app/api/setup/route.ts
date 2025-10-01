import { NextRequest, NextResponse } from 'next/server';
import { addMissingEnvVars } from '@/lib/env';
import path from 'path';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { beeperToken, openaiKey } = body;

    const envPath = path.join(process.cwd(), '.env.local');
    const newEntries: Record<string, string> = {};

    if (beeperToken) {
      newEntries.BEEPER_MCP_TOKEN = beeperToken;
    }

    if (openaiKey) {
      newEntries.OPENAI_API_KEY = openaiKey;
    }

    const addedKeys = addMissingEnvVars(newEntries, envPath);

    return NextResponse.json({
      success: true,
      added: addedKeys
    });
  } catch (error) {
    console.error('Error saving tokens:', error);
    return NextResponse.json(
      { error: 'Failed to save tokens' },
      { status: 500 }
    );
  }
}
