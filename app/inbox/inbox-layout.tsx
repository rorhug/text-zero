'use client';

import { useState } from 'react';
import { InboxContent } from './inbox-content';
import { ConversationView } from './[chat_id]/conversation-view';

export function InboxLayout({ initialChatId }: { initialChatId?: string }) {
  const [selectedChatId, setSelectedChatId] = useState<string | null>(
    initialChatId || null,
  );

  return (
    <div className="flex h-screen">
      {/* Inbox List - 50% */}
      <div className="w-1/2 border-r border-border/40 overflow-hidden">
        <InboxContent
          onChatSelect={(chatId) => setSelectedChatId(chatId)}
          selectedChatId={selectedChatId}
        />
      </div>

      {/* Conversation View - 50% */}
      <div className="w-1/2 overflow-hidden">
        {selectedChatId ? (
          <ConversationView
            chatId={selectedChatId}
            onBack={() => setSelectedChatId(null)}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            Select a conversation to view
          </div>
        )}
      </div>
    </div>
  );
}
