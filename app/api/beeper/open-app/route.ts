import { NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import BeeperDesktop from '@beeper/desktop-api';

export async function POST(request: Request) {
  try {
    console.log('=== BEEPER OPEN APP API CALLED ===');
    
    const session = await auth();
    if (!session?.user) {
      console.log('No session found');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const accessToken = process.env.BEEPER_MCP_TOKEN;
    if (!accessToken) {
      console.log('BEEPER_MCP_TOKEN not configured');
      return NextResponse.json(
        { error: 'BEEPER_MCP_TOKEN is not configured' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { chatID, localChatID, draftText, draftAttachmentPath, messageID } = body;
    
    console.log('Request body:', { chatID, localChatID, draftText, draftAttachmentPath, messageID });
    console.log('Access token exists:', !!accessToken);
    
    // Use localChatID if available, otherwise fallback to chatID
    const targetChatID = localChatID || chatID;
    console.log('Using chat ID:', targetChatID);

    // Use BeeperDesktop SDK like other API calls
    const client = new BeeperDesktop({
      accessToken,
    });

    console.log('Using BeeperDesktop SDK to open app');
    
    // Try different possible method names
    let response;
    try {
      // Try client.app.open first
      response = await client.app.open({
        chatID: targetChatID,
        draftText,
        draftAttachmentPath,
        messageID,
      });
      console.log('Success with client.app.open');
    } catch (appError) {
      console.log('client.app.open failed, trying client.open');
      try {
        // Try client.open
        response = await client.open({
          chatID: targetChatID,
          draftText,
          draftAttachmentPath,
          messageID,
        });
        console.log('Success with client.open');
      } catch (openError) {
        console.log('client.open failed, trying direct HTTP call');
        // Fallback to direct HTTP call
        const httpResponse = await fetch('http://localhost:23373/v0/open-app', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            chatID: targetChatID,
            draftText,
            draftAttachmentPath,
            messageID,
          }),
        });

        if (!httpResponse.ok) {
          const errorText = await httpResponse.text();
          throw new Error(`HTTP error! status: ${httpResponse.status}, body: ${errorText}`);
        }

        response = await httpResponse.json();
        console.log('Success with direct HTTP call');
      }
    }

    console.log('Beeper API success response:', response);
    return NextResponse.json(response);
  } catch (error) {
    console.error('Error opening Beeper Desktop:', error);
    return NextResponse.json(
      { error: 'Failed to open Beeper Desktop', details: error.message },
      { status: 500 }
    );
  }
}
