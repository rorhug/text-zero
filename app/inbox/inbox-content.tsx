'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect, useCallback } from 'react';
import useSWR from 'swr';
import { fetcher } from '@/lib/utils';
import { LoaderIcon } from '@/components/icons';
import type { BeeperDesktop } from '@beeper/desktop-api';

type Chat = BeeperDesktop.Chats.Chat;
type Message = BeeperDesktop.Message;

interface ChatWithLastMessage extends Chat {
  lastMessage: Message | null;
  isUnresponded: boolean;
  isUnread: boolean;
}

interface ConversationsResponse {
  conversations: ChatWithLastMessage[];
  hasMore: boolean;
}

function ConversationRow({
  conversation,
  isSelected,
  onClick,
  isArchiving = false,
}: {
  conversation: ChatWithLastMessage;
  isSelected: boolean;
  onClick: () => void;
  isArchiving?: boolean;
}) {
  const {
    isUnresponded,
    isUnread,
    lastMessage,
    lastActivity,
    title,
    unreadCount,
  } = conversation;

  const displayName = title || 'Unknown Chat';

  const formatTimestamp = (timestamp?: string) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return date.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      });
    } else if (diffInHours < 168) {
      // 1 week
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  // Get the first participant that's not the user for avatar
  const otherParticipant = conversation.participants.items.find(
    (p) => !p.isSelf,
  );

  // Use lastMessage timestamp if available, otherwise fallback to lastActivity
  const displayTimestamp = lastMessage?.timestamp || lastActivity;
  const lastMessageText = lastMessage?.text || 'No messages';
  const lastMessageSender = lastMessage?.senderName;

  const status = isUnread ? 'Unread' : isUnresponded ? 'Unresponded' : null;

  return (
    <div
      className={`w-full border-b border-border/40 hover:bg-muted/50 transition-colors cursor-pointer ${
        isSelected
          ? 'bg-muted border-l-4 border-l-primary'
          : 'border-l-4 border-l-muted'
      } ${isArchiving ? 'opacity-50' : ''}`}
      onClick={onClick}
    >
      <div className="flex items-center gap-3 p-4">
        {isArchiving && (
          <div className="flex items-center justify-center w-4 h-4">
            <div className="animate-spin">
              <LoaderIcon size={12} />
            </div>
          </div>
        )}
        <div className="flex-shrink-0">
          {otherParticipant?.imgURL ? (
            <img
              src={otherParticipant.imgURL}
              alt={displayName}
              className="w-12 h-12 rounded-full object-cover"
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
              <span className="text-lg font-medium text-muted-foreground">
                {displayName.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <h3 className="font-medium text-foreground truncate">
                {displayName}
              </h3>
              {status && (
                <span className="text-xs text-muted-foreground">{status}</span>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {displayTimestamp && (
                <span>{formatTimestamp(displayTimestamp)}</span>
              )}
              {unreadCount > 0 && (
                <span className="bg-primary text-primary-foreground rounded-full px-2 py-0.5 text-xs font-medium">
                  {unreadCount}
                </span>
              )}
            </div>
          </div>

          <div className="text-sm text-muted-foreground truncate">
            {lastMessageSender && !lastMessage?.isSender && (
              <span className="font-medium">{lastMessageSender}: </span>
            )}
            {lastMessage?.isSender && (
              <span className="font-medium">You: </span>
            )}
            {lastMessageText}
          </div>
        </div>
      </div>
    </div>
  );
}

export function InboxContent() {
  const router = useRouter();
  const [filter, setFilter] = useState<'unresponded' | 'all'>('unresponded');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [archivingConversation, setArchivingConversation] = useState<
    string | null
  >(null);

  const { data, error, isLoading, mutate } = useSWR<ConversationsResponse>(
    '/inbox/api',
    fetcher,
    {
      refreshInterval: 30000, // Refresh every 30 seconds
    },
  );

  // Filter conversations based on the current filter
  const filteredConversations =
    data?.conversations.filter((conv) => {
      if (filter === 'unresponded') {
        return conv.isUnresponded || conv.isUnread;
      }
      return true; // 'all' shows everything
    }) || [];

  // Reset selected index when conversations change
  useEffect(() => {
    if (
      filteredConversations.length > 0 &&
      selectedIndex >= filteredConversations.length
    ) {
      setSelectedIndex(0);
    }
  }, [filteredConversations.length, selectedIndex]);

  const handleArchiveConversation = async (conversationId: string) => {
    setArchivingConversation(conversationId);
    try {
      const response = await fetch('/inbox/archive', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chatId: conversationId,
          archived: true,
        }),
      });

      if (response.ok) {
        // Refresh the conversation list
        await mutate();
        // Adjust selected index if needed
        if (
          selectedIndex >= filteredConversations.length - 1 &&
          selectedIndex > 0
        ) {
          setSelectedIndex(selectedIndex - 1);
        }
      } else {
        console.error('Failed to archive conversation');
      }
    } catch (error) {
      console.error('Error archiving conversation:', error);
    } finally {
      setArchivingConversation(null);
    }
  };

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (filteredConversations.length === 0) return;

      switch (e.key) {
        case 'ArrowUp':
        case 'k':
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev > 0 ? prev - 1 : filteredConversations.length - 1,
          );
          break;
        case 'ArrowDown':
        case 'j':
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev < filteredConversations.length - 1 ? prev + 1 : 0,
          );
          break;
        case 'ArrowRight':
        case 'l':
        case 'Enter':
          e.preventDefault();
          if (filteredConversations[selectedIndex]) {
            router.push(
              `/inbox/${encodeURIComponent(filteredConversations[selectedIndex].id)}`,
            );
          }
          break;
        case 'e':
        case 'a':
          e.preventDefault();
          if (filteredConversations[selectedIndex] && !archivingConversation) {
            handleArchiveConversation(filteredConversations[selectedIndex].id);
          }
          break;
      }
    },
    [
      filteredConversations,
      selectedIndex,
      router,
      archivingConversation,
      handleArchiveConversation,
    ],
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const handleConversationClick = (index: number) => {
    setSelectedIndex(index);
    router.push(
      `/inbox/${encodeURIComponent(filteredConversations[index].id)}`,
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin">
          <LoaderIcon />
        </div>
        <span className="ml-2">Loading conversations...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <p className="text-destructive mb-2">Failed to load conversations</p>
          <p className="text-sm text-muted-foreground">
            {error.message || 'Unknown error occurred'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-border/40 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Inbox</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {filteredConversations.length} conversation
              {filteredConversations.length !== 1 ? 's' : ''}
              {filter === 'unresponded' && data?.conversations && (
                <span> ({data.conversations.length} total)</span>
              )}
            </p>
          </div>

          <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
            <button
              type="button"
              onClick={() => setFilter('unresponded')}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${
                filter === 'unresponded'
                  ? 'bg-background shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Unresponded
            </button>
            <button
              type="button"
              onClick={() => setFilter('all')}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${
                filter === 'all'
                  ? 'bg-background shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              All
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {filteredConversations.length === 0 ? (
          <div className="flex items-center justify-center h-96">
            <div className="text-center">
              <p className="text-muted-foreground">
                {filter === 'unresponded'
                  ? 'No unresponded conversations'
                  : 'No conversations found'}
              </p>
              {filter === 'unresponded' && data?.conversations?.length && (
                <p className="text-xs text-muted-foreground mt-1">
                  Switch to "All" to see {data.conversations.length} total
                  conversations
                </p>
              )}
            </div>
          </div>
        ) : (
          filteredConversations.map((conversation, index) => (
            <ConversationRow
              key={conversation.id}
              conversation={conversation}
              isSelected={index === selectedIndex}
              onClick={() => handleConversationClick(index)}
              isArchiving={archivingConversation === conversation.id}
            />
          ))
        )}
      </div>

      {filteredConversations.length > 0 && (
        <div className="border-t border-border/40 px-4 py-2 text-xs text-muted-foreground">
          Use ↑↓ or j/k to navigate, → or Enter to open, e/a to archive
        </div>
      )}
    </div>
  );
}
