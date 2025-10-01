'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect, useCallback } from 'react';
import useSWR from 'swr';
import { fetcher } from '@/lib/utils';
import { LoaderIcon } from '@/components/icons';
import { VersionBadge } from '@/components/version-badge';
import type { BeeperDesktop } from '@beeper/desktop-api';
import Shortcut from '@/components/shortcut';

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
  isSelectedChat = false,
}: {
  conversation: ChatWithLastMessage;
  isSelected: boolean;
  onClick: () => void;
  isArchiving?: boolean;
  isSelectedChat?: boolean;
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

  const platform = conversation.network;

  return (
    <div
      className={`w-full border-b border-border/40 hover:bg-muted/50 transition-colors cursor-pointer ${
        isSelectedChat
          ? 'bg-primary/10 border-l-4 border-l-primary'
          : isSelected
            ? 'bg-muted border-l-4 border-l-primary/50'
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
              {platform && (
                <span className="text-xs text-muted-foreground">
                  {platform}
                </span>
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

export function InboxContent({
  onChatSelect,
  selectedChatId,
}: {
  onChatSelect?: (chatId: string) => void;
  selectedChatId?: string | null;
}) {
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

      // Don't handle shortcuts when any input/textarea is focused
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

      // Don't handle single-key shortcuts when Cmd is pressed (preserve browser shortcuts)
      if (e.metaKey || e.ctrlKey) return;

      switch (e.key) {
        case 'ArrowUp':
          if (!e.altKey) {
            e.preventDefault();
            setSelectedIndex((prev) =>
              prev > 0 ? prev - 1 : filteredConversations.length - 1,
            );
          }
          break;
        case 'k':
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev > 0 ? prev - 1 : filteredConversations.length - 1,
          );
          break;
        case 'ArrowDown':
          if (!e.altKey) {
            e.preventDefault();
            setSelectedIndex((prev) =>
              prev < filteredConversations.length - 1 ? prev + 1 : 0,
            );
          }
          break;
        case 'j':
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev < filteredConversations.length - 1 ? prev + 1 : 0,
          );
          break;
        case 'ArrowRight':
          if (!e.altKey) {
            e.preventDefault();
            if (filteredConversations[selectedIndex]) {
              const chatId = filteredConversations[selectedIndex].id;
              if (onChatSelect) {
                onChatSelect(chatId);
                window.history.replaceState(
                  null,
                  '',
                  `/inbox/${encodeURIComponent(chatId)}`,
                );
              } else {
                router.push(`/inbox/${encodeURIComponent(chatId)}`);
              }
            }
          }
          break;
        case 'l':
          e.preventDefault();
          if (filteredConversations[selectedIndex]) {
            const chatId = filteredConversations[selectedIndex].id;
            if (onChatSelect) {
              onChatSelect(chatId);
              window.history.replaceState(
                null,
                '',
                `/inbox/${encodeURIComponent(chatId)}`,
              );
            } else {
              router.push(`/inbox/${encodeURIComponent(chatId)}`);
            }
          }
          break;
        case 'e':
          e.preventDefault();
          if (filteredConversations[selectedIndex] && !archivingConversation) {
            handleArchiveConversation(filteredConversations[selectedIndex].id);
          }
          break;
        case 'u':
          e.preventDefault();
          setFilter('unresponded');
          break;
        case 'a':
          e.preventDefault();
          setFilter('all');
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
    const chatId = filteredConversations[index].id;
    if (onChatSelect) {
      onChatSelect(chatId);
      window.history.replaceState(
        null,
        '',
        `/inbox/${encodeURIComponent(chatId)}`,
      );
    } else {
      router.push(`/inbox/${encodeURIComponent(chatId)}`);
    }
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
            <h1 className="text-2xl font-bold">Text ZERO</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {filteredConversations.length} conversation
              {filteredConversations.length !== 1 ? 's' : ''}
              {filter === 'unresponded' && data?.conversations && (
                <span> ({data.conversations.length} total)</span>
              )}
            </p>
          </div>

          <div className="flex items-center gap-4">
            <VersionBadge />
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
                <Shortcut keys="u" text="unresponded" />
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
                <Shortcut keys="a" text="all" />
              </button>
            </div>
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
              isSelectedChat={selectedChatId === conversation.id}
            />
          ))
        )}
      </div>

      {filteredConversations.length > 0 && (
        <div className="border-t border-border/40 px-4 py-2 text-xs text-muted-foreground gap-1 flex">
          {/* Use ↑↓ or j/k to navigate, → or Enter to open, e to archive, u/a to filter */}
          <Shortcut keys="hjkl / ˂↑↓˃" text="navigate" />
          <Shortcut keys="e" text="archive" />
          <Shortcut keys="u/a" text="filter" />
        </div>
      )}
    </div>
  );
}
